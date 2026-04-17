const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database/moupress.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ─── Create All Tables ────────────────────────────────────────────────────────

db.exec(`

  -- USERS
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'estimator',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- AUDIT LOG
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- CUSTOMERS
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    markup_percent REAL DEFAULT 30,
    cash_only INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- SUPPLIERS
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    category TEXT,
    default_markup REAL DEFAULT 15,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- PAPER STOCKS
  CREATE TABLE IF NOT EXISTS paper_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gsm INTEGER NOT NULL,
    coating TEXT NOT NULL,
    sheet_width REAL NOT NULL,
    sheet_height REAL NOT NULL,
    sheets_per_pack INTEGER NOT NULL,
    pack_weight_kg REAL,
    rate_per_kg REAL NOT NULL,
    pack_cost REAL,
    cost_per_sheet REAL,
    supplier_id INTEGER,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- MACHINES
  CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    hourly_rate REAL NOT NULL,
    speed REAL NOT NULL,
    speed_unit TEXT DEFAULT 'sheets/hr',
    click_charge REAL DEFAULT 0,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- FINISHING OPERATIONS
  CREATE TABLE IF NOT EXISTS finishing_ops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    rate REAL NOT NULL,
    rate_unit TEXT NOT NULL,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- QUOTES
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_no TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    cash_customer_name TEXT,
    job_type TEXT NOT NULL,
    print_method TEXT NOT NULL,
    specs TEXT NOT NULL,
    qty1 INTEGER,
    qty2 INTEGER,
    qty3 INTEGER,
    total1 REAL,
    total2 REAL,
    total3 REAL,
    markup_percent REAL DEFAULT 30,
    status TEXT DEFAULT 'Draft',
    expiry_date TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_by INTEGER,
    updated_at TEXT
  );

  -- COMPANY SETTINGS
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

`);

// ─── Seed Default Admin User ──────────────────────────────────────────────────
const bcrypt = require('bcryptjs');

const adminExists = db.prepare(
  'SELECT id FROM users WHERE username = ?'
).get('admin');

if (!adminExists) {
  const hashed = bcrypt.hashSync('MouPress@2026', 10);
  db.prepare(`
    INSERT INTO users (username, password, full_name, role)
    VALUES (?, ?, ?, ?)
  `).run('admin', hashed, 'Administrator', 'admin');
  console.log('✅ Default admin user created');
}

// ─── Seed Default Company Settings ───────────────────────────────────────────
const settingsDefaults = [
  ['company_name', 'Mou Press'],
  ['company_address', ''],
  ['company_phone', ''],
  ['company_email', ''],
  ['quote_expiry_days', '30'],
  ['gst_enabled', 'false'],
  ['gst_rate', '18'],
  ['currency', '₹'],
  ['terms', 'Payment due within 30 days. Prices valid for 30 days from quote date.']
];

const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
settingsDefaults.forEach(([k, v]) => insertSetting.run(k, v));

console.log('✅ Database ready');

module.exports = db;