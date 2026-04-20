const Database = require('better-sqlite3');
const path = require('path');

const defaultDbPath = process.env.VERCEL
  ? '/tmp/trackflow.db'
  : path.join(__dirname, '../../data/trackflow.db');
const DB_PATH = process.env.TRACKFLOW_DB_PATH || defaultDbPath;

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parcels (
      id TEXT PRIMARY KEY,
      tracking_code TEXT UNIQUE NOT NULL,
      qr_code_data TEXT,
      sender_name TEXT NOT NULL,
      sender_phone TEXT,
      sender_email TEXT,
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      recipient_email TEXT,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      weight_kg REAL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'registered',
      sms_notified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tracking_events (
      id TEXT PRIMARY KEY,
      parcel_id TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT NOT NULL,
      scanned_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parcel_id) REFERENCES parcels(id)
    );

    CREATE TABLE IF NOT EXISTS scan_points (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'transit',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'readonly',
      full_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_parcels_tracking_code ON parcels(tracking_code);
    CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
    CREATE INDEX IF NOT EXISTS idx_parcels_recipient_phone ON parcels(recipient_phone);
    CREATE INDEX IF NOT EXISTS idx_tracking_events_parcel_id ON tracking_events(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_tracking_events_created_at ON tracking_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
  seedDefaultAdmin(db);
}

function seedDefaultAdmin(db) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, full_name)
      VALUES (?, 'admin', ?, 'admin', 'Administrateur TrackFlow')
    `).run(crypto.randomUUID(), hash);
  }
}

module.exports = { getDb };
