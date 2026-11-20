import * as satellite from 'satellite.js';

export function parseTleOrbitalParams(tle1, tle2) {
  const satrec = satellite.twoline2satrec(tle1, tle2);
  const meanMotionRadMin = satrec.no;
  const periodMin = meanMotionRadMin > 0 ? (2 * Math.PI) / meanMotionRadMin : 90;
  const ecc = satrec.ecco;
  const incDeg = (satrec.inclo * 180) / Math.PI;
  const T_sec = periodMin * 60;
  const aKm = Math.cbrt((398600.4418 * T_sec * T_sec) / (4 * Math.PI * Math.PI));
  const Rt = 6378.137;
  const perigeeKm = Math.max(100, aKm * (1 - ecc) - Rt);
  const apogeeKm = Math.max(perigeeKm, aKm * (1 + ecc) - Rt);
  return { periodMin, ecc, incDeg, perigeeKm, apogeeKm, satrec };
}

export function propagateTleToArchive(db, noradId, tle1, tle2, periodMin) {
  const satrec = satellite.twoline2satrec(tle1, tle2);
  const durationSec = Math.min(Math.round(periodMin * 60 * 1.05), 40000);
  const stepSec = durationSec > 20000 ? 5 : 1;
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - durationSec;

  const insertPos = db.prepare(`
    INSERT OR IGNORE INTO positions (norad_id, timestamp, lat, lon, altitude_km, source)
    VALUES (?, ?, ?, ?, ?, 'sgp4_tle')
  `);

  let inserted = 0;
  db.exec('BEGIN TRANSACTION');
  try {
    for (let dt = 0; dt <= durationSec; dt += stepSec) {
      const ts = startSec + dt;
      const date = new Date(ts * 1000);
      const pv = satellite.propagate(satrec, date);
      if (!pv.position || typeof pv.position === 'boolean') continue;
      const gmst = satellite.gstime(date);
      const geo = satellite.eciToGeodetic(pv.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const altKm = geo.height;
      if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(altKm)) {
        insertPos.run(noradId, ts, lat, lon, altKm);
        inserted++;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return inserted;
}
