import 'dotenv/config';
import { getDb, getHourlyApiUsage, recordApiUsage } from '../server/db.mjs';

const N2YO_BASE = 'https://api.n2yo.com/rest/v1/satellite';
const MAX_HOURLY_REQUESTS = 900; // Marge de sécurité sous la limite officielle de 1 000 req/h

async function collectSatellitePositions(db, sat, apiKey) {
  const usage = getHourlyApiUsage(db);
  if (usage >= MAX_HOURLY_REQUESTS) {
    console.warn(`[Collecteur] Quota horaire atteint (${usage}/${MAX_HOURLY_REQUESTS}). Pause.`);
    return 0;
  }

  // Paquet de 300 secondes à 1 Hz (observer 0,0,0 — lat/lon/alt du satellite sont indépendants de l'observateur)
  const url = `${N2YO_BASE}/positions/${sat.norad_id}/0/0/0/300&apiKey=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  recordApiUsage(db, 'positions');

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} pour ${sat.name} (${sat.norad_id})`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`API N2YO erreur pour ${sat.norad_id}: ${data.error}`);
  }

  const positions = Array.isArray(data.positions) ? data.positions : [];
  if (positions.length === 0) return 0;

  const insertPos = db.prepare(`
    INSERT OR REPLACE INTO positions (norad_id, timestamp, lat, lon, altitude_km, source)
    VALUES (?, ?, ?, ?, ?, 'n2yo')
  `);

  let inserted = 0;
  db.exec('BEGIN TRANSACTION');
  try {
    for (const p of positions) {
      if (
        Number.isFinite(p.timestamp) &&
        Number.isFinite(p.satlatitude) &&
        Number.isFinite(p.satlongitude) &&
        Number.isFinite(p.sataltitude)
      ) {
        const info = insertPos.run(
          sat.norad_id,
          Math.round(p.timestamp),
          p.satlatitude,
          p.satlongitude,
          p.sataltitude
        );
        inserted += info.changes || 0;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return inserted;
}

export async function runCollection() {
  const apiKey = process.env.N2YO_API_KEY;
  if (!apiKey || apiKey === 'votre_cle_api_n2yo_ici') {
    console.log('[Collecteur] N2YO_API_KEY non configurée. Mode archive locale uniquement.');
    return { ok: false, reason: 'missing_api_key', inserted: 0 };
  }

  const db = getDb();
  const satellites = db.prepare('SELECT * FROM satellites WHERE is_active = 1').all();
  let totalInserted = 0;

  for (const sat of satellites) {
    try {
      const inserted = await collectSatellitePositions(db, sat, apiKey);
      totalInserted += inserted;
      console.log(`[Collecteur] ${sat.name} (${sat.norad_id}) : +${inserted} nouveaux points.`);
    } catch (err) {
      console.error(`[Collecteur] Échec pour ${sat.name} (${sat.norad_id}):`, err.message);
    }
  }

  return { ok: true, inserted: totalInserted };
}

if (process.argv[1] && process.argv[1].endsWith('collect.mjs')) {
  runCollection()
    .then((r) => {
      console.log('[Collecteur] Terminé:', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Collecteur] Erreur fatale:', err);
      process.exit(1);
    });
}
