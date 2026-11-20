import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDb, getHourlyApiUsage, recordApiUsage } from './db.mjs';
import { parseTleOrbitalParams, propagateTleToArchive } from './tle_utils.mjs';
import { seedArchive } from '../collector/seed_archive.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 3001);

const app = express();
app.use(cors());
app.use(express.json());

const db = getDb();
seedArchive();

const addRateLimiter = new Map();

app.get('/api/status', (_req, res) => {
  const totalPositions = db.prepare('SELECT COUNT(*) as cnt FROM positions').get();
  const totalSatellites = db.prepare('SELECT COUNT(*) as cnt FROM satellites').get();
  const lastPos = db.prepare('SELECT MAX(timestamp) as maxTs FROM positions').get();
  const apiUsage = getHourlyApiUsage(db);
  const hasN2yoKey = Boolean(
    process.env.N2YO_API_KEY && process.env.N2YO_API_KEY !== 'votre_cle_api_n2yo_ici'
  );

  res.json({
    ok: true,
    totalSatellites: Number(totalSatellites?.cnt || 0),
    totalPositions: Number(totalPositions?.cnt || 0),
    lastTimestamp: lastPos?.maxTs ? Number(lastPos.maxTs) : null,
    n2yoConfigured: hasN2yoKey,
    n2yoHourlyUsage: apiUsage,
    n2yoHourlyLimit: 1000,
  });
});

app.get('/api/satellites', (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT s.*,
        (SELECT COUNT(*) FROM positions p WHERE p.norad_id = s.norad_id) as position_count,
        (SELECT MIN(timestamp) FROM positions p WHERE p.norad_id = s.norad_id) as min_ts,
        (SELECT MAX(timestamp) FROM positions p WHERE p.norad_id = s.norad_id) as max_ts
      FROM satellites s
      ORDER BY
        CASE s.category WHEN 'elliptical' THEN 0 WHEN 'circular' THEN 1 ELSE 2 END,
        s.norad_id ASC
    `
    )
    .all();

  res.json({ satellites: rows });
});

app.get('/api/satellites/:noradId/positions', (req, res) => {
  const noradId = Number(req.params.noradId);
  if (!Number.isInteger(noradId) || noradId <= 0) {
    return res.status(400).json({ error: 'NORAD ID invalide.' });
  }

  const sat = db.prepare('SELECT * FROM satellites WHERE norad_id = ?').get(noradId);
  if (!sat) {
    return res.status(404).json({ error: 'Satellite introuvable dans l\'archive.' });
  }

  const step = Math.max(1, Math.min(3600, Number(req.query.step) || 30));
  const limit = Math.max(10, Math.min(20000, Number(req.query.limit) || 5000));

  const bounds = db
    .prepare('SELECT MIN(timestamp) as minTs, MAX(timestamp) as maxTs FROM positions WHERE norad_id = ?')
    .get(noradId);

  if (!bounds || bounds.minTs === null) {
    return res.json({ satellite: sat, positions: [], step });
  }

  const fromTs = req.query.from ? Number(req.query.from) : Number(bounds.minTs);
  const toTs = req.query.to ? Number(req.query.to) : Number(bounds.maxTs);

  const rows = db
    .prepare(
      `
      SELECT timestamp, lat, lon, altitude_km, source
      FROM positions
      WHERE norad_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
        AND ((timestamp - ?) % ? = 0)
      ORDER BY timestamp ASC
      LIMIT ?
    `
    )
    .all(noradId, fromTs, toTs, fromTs, step, limit);

  res.json({
    satellite: sat,
    step,
    minTs: Number(bounds.minTs),
    maxTs: Number(bounds.maxTs),
    positions: rows,
  });
});


app.post('/api/satellites', async (req, res) => {
  const noradId = Number(req.body?.noradId);
  if (!Number.isInteger(noradId) || noradId < 1 || noradId > 999999) {
    return res.status(400).json({ error: 'Veuillez saisir un NORAD ID entier valide (1 à 999999).' });
  }

  const existing = db.prepare('SELECT * FROM satellites WHERE norad_id = ?').get(noradId);
  if (existing) {
    return res.json({ satellite: existing, alreadyExists: true });
  }

  const ip = req.ip || 'local';
  const now = Date.now();
  const recent = (addRateLimiter.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (recent.length >= 10) {
    return res.status(429).json({ error: 'Trop de requêtes d\'ajout. Réessayez dans quelques minutes.' });
  }
  recent.push(now);
  addRateLimiter.set(ip, recent);

  let name = `NORAD ${noradId}`;
  let tle1 = '';
  let tle2 = '';

  const apiKey = process.env.N2YO_API_KEY;
  const hasN2yoKey = Boolean(apiKey && apiKey !== 'votre_cle_api_n2yo_ici');

  try {
    if (hasN2yoKey && getHourlyApiUsage(db) < 900) {
      const url = `https://api.n2yo.com/rest/v1/satellite/tle/${noradId}&apiKey=${apiKey}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      recordApiUsage(db, 'tle');
      if (r.ok) {
        const data = await r.json();
        if (data?.tle) {
          const lines = data.tle.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            tle1 = lines[0];
            tle2 = lines[1];
            name = data.info?.satname || name;
          }
        }
      }
    }

    if (!tle1 || !tle2) {
      const ctUrl = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=tle`;
      const r = await fetch(ctUrl, { signal: AbortSignal.timeout(10000) });
      if (r.ok) {
        const text = await r.text();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length >= 3 && lines[1].startsWith('1 ') && lines[2].startsWith('2 ')) {
          name = lines[0];
          tle1 = lines[1];
          tle2 = lines[2];
        } else if (lines.length >= 2 && lines[0].startsWith('1 ') && lines[1].startsWith('2 ')) {
          tle1 = lines[0];
          tle2 = lines[1];
        }
      }
    }
  } catch (err) {
    console.warn(`[Add Satellite] Erreur récupération TLE pour ${noradId}:`, err.message);
  }

  if (!tle1 || !tle2) {
    return res.status(404).json({
      error: `Impossible de récupérer les paramètres TLE pour le NORAD ID ${noradId}.`,
    });
  }

  const params = parseTleOrbitalParams(tle1, tle2);
  const category = params.ecc >= 0.05 ? 'elliptical' : 'circular';
  const desc = `Satellite ajouté via NORAD ID ${noradId} (e = ${params.ecc.toFixed(4)}, T = ${params.periodMin.toFixed(1)} min).`;

  db.prepare(
    `
    INSERT INTO satellites
      (norad_id, name, category, description, perigee_km, apogee_km, eccentricity, period_min, inclination_deg, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `
  ).run(
    noradId,
    name,
    category,
    desc,
    Math.round(params.perigeeKm),
    Math.round(params.apogeeKm),
    Number(params.ecc.toFixed(5)),
    Number(params.periodMin.toFixed(2)),
    Number(params.incDeg.toFixed(2))
  );

  db.prepare('INSERT OR IGNORE INTO tle_history (norad_id, epoch, line1, line2) VALUES (?, ?, ?, ?)').run(
    noradId,
    new Date().toISOString().slice(0, 10),
    tle1,
    tle2
  );

  const inserted = propagateTleToArchive(db, noradId, tle1, tle2, params.periodMin);
  const created = db.prepare('SELECT * FROM satellites WHERE norad_id = ?').get(noradId);

  res.status(201).json({ satellite: created, positionsSeeded: inserted });
});

app.get('/api/kepler3', (_req, res) => {
  const sats = db.prepare('SELECT * FROM satellites ORDER BY period_min ASC').all();
  const Rt = 6378.0;
  const items = sats
    .filter((s) => s.perigee_km != null && s.apogee_km != null && s.period_min != null)
    .map((s) => {
      const rp = Rt + Number(s.perigee_km);
      const ra = Rt + Number(s.apogee_km);
      const aKm = (rp + ra) / 2;
      return {
        norad_id: s.norad_id,
        name: s.name,
        category: s.category,
        perigee_km: Number(s.perigee_km),
        apogee_km: Number(s.apogee_km),
        a_km: aKm,
        period_min: Number(s.period_min),
      };
    });
  res.json({ satellites: items });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[KeplerLab API] Serveur démarré sur http://localhost:${PORT}`);
});

