import * as satellite from 'satellite.js';
import { getDb } from '../server/db.mjs';
import { DEFAULT_SATELLITES } from '../server/satellites_data.mjs';

/**
 * Génère une archive SGP4 haute résolution (1 Hz) sur une orbite complète
 * pour chaque satellite pédagogique par défaut.
 * Permet un fonctionnement 100% fiable même hors-ligne ou si l'API N2YO est indisponible.
 */
export function seedArchive({ force = false } = {}) {
  const db = getDb();
  const insertPos = db.prepare(`
    INSERT OR IGNORE INTO positions (norad_id, timestamp, lat, lon, altitude_km, source)
    VALUES (?, ?, ?, ?, ?, 'sgp4_archive')
  `);

  // Référence temporelle fixe cohérente avec l'époque TLE (ou maintenant si besoin)
  const nowSec = Math.floor(Date.now() / 1000);

  let totalInserted = 0;

  for (const sat of DEFAULT_SATELLITES) {
    const existing = db
      .prepare('SELECT COUNT(*) as cnt FROM positions WHERE norad_id = ?')
      .get(sat.norad_id);

    if (!force && existing && Number(existing.cnt) >= 1000) {
      continue;
    }

    const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
    // Durée d'une orbite complète en secondes (avec un léger surplus de 5%)
    const durationSec = Math.min(Math.round(sat.period_min * 60 * 1.05), 40000);
    const startSec = nowSec - durationSec;

    db.exec('BEGIN TRANSACTION');
    try {
      let satInserted = 0;
      for (let dt = 0; dt <= durationSec; dt += 1) {
        const ts = startSec + dt;
        const date = new Date(ts * 1000);
        const positionAndVelocity = satellite.propagate(satrec, date);
        const positionEci = positionAndVelocity.position;
        if (!positionEci || typeof positionEci === 'boolean') continue;

        const gmst = satellite.gstime(date);
        const geodetic = satellite.eciToGeodetic(positionEci, gmst);
        const lat = satellite.degreesLat(geodetic.latitude);
        const lon = satellite.degreesLong(geodetic.longitude);
        const altKm = geodetic.height;

        if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(altKm)) {
          insertPos.run(sat.norad_id, ts, lat, lon, altKm);
          satInserted++;
        }
      }
      db.exec('COMMIT');
      totalInserted += satInserted;
      console.log(`[Seed SGP4] ${sat.name} (${sat.norad_id}) : ${satInserted} points à 1 Hz archivés.`);
    } catch (err) {
      db.exec('ROLLBACK');
      console.error(`[Seed SGP4] Erreur pour ${sat.name}:`, err);
    }
  }

  return totalInserted;
}

// Exécution directe en CLI
if (process.argv[1] && process.argv[1].endsWith('seed_archive.mjs')) {
  const force = process.argv.includes('--force');
  const count = seedArchive({ force });
  console.log(`[Seed SGP4] Terminé. Total points insérés : ${count}`);
}
