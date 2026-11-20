import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SATELLITES } from './satellites_data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'kepler.db');

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS satellites (
      norad_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'custom',
      description TEXT DEFAULT '',
      perigee_km REAL,
      apogee_km REAL,
      eccentricity REAL,
      period_min REAL,
      inclination_deg REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS positions (
      norad_id INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      altitude_km REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'n2yo',
      PRIMARY KEY (norad_id, timestamp),
      FOREIGN KEY (norad_id) REFERENCES satellites(norad_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_positions_sat_time ON positions(norad_id, timestamp);

    CREATE TABLE IF NOT EXISTS tle_history (
      norad_id INTEGER NOT NULL,
      epoch TEXT NOT NULL,
      line1 TEXT NOT NULL,
      line2 TEXT NOT NULL,
      fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (norad_id, epoch)
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  db.exec("DELETE FROM satellites WHERE norad_id IN (37820, 39234);");

  const insertSat = db.prepare(`
    INSERT OR IGNORE INTO satellites
      (norad_id, name, category, description, perigee_km, apogee_km, eccentricity, period_min, inclination_deg, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertTle = db.prepare(`
    INSERT OR IGNORE INTO tle_history (norad_id, epoch, line1, line2)
    VALUES (?, '2026-320.5', ?, ?)
  `);

  for (const sat of DEFAULT_SATELLITES) {
    insertSat.run(
      sat.norad_id,
      sat.name,
      sat.category,
      sat.description,
      sat.perigee_km,
      sat.apogee_km,
      sat.eccentricity,
      sat.period_min,
      sat.inclination_deg
    );
    insertTle.run(sat.norad_id, sat.tle1, sat.tle2);
  }

  dbInstance = db;
  return db;
}

export function getHourlyApiUsage(db) {
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  const row = db.prepare('SELECT COUNT(*) as count FROM api_usage WHERE timestamp >= ?').get(oneHourAgo);
  return row ? Number(row.count) : 0;
}

export function recordApiUsage(db, endpoint) {
  db.prepare('INSERT INTO api_usage (endpoint, timestamp) VALUES (?, ?)').run(
    endpoint,
    Math.floor(Date.now() / 1000)
  );
}
