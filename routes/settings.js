const express = require('express');
const router = express.Router();
const db = require('../database');

// Ensure settings table exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT (datetime('now'))
  )
`).run();

const DEFAULTS = {
  company_name: 'Mou Press',
  company_tagline: 'Quality Printing Solutions',
  address: '',
  phone: '',
  email: '',
  website: '',
  gst_number: '',
  gst_rate: '18',
  gst_display: 'excl',
  currency: '₹',
  default_expiry_days: '30',
  default_markup: '30',
  default_method: '',
  makeready_low: '100',
  makeready_high_extra: '100',
  makeready_sig: '100',
  terms: ''
};

// GET all settings as flat object
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`SELECT key, value FROM settings`).all();
    const out = { ...DEFAULTS };
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch(e) {
    res.status(500).json({ message: 'Error loading settings: ' + e.message });
  }
});

// POST — upsert all provided settings
router.post('/', (req, res) => {
  try {
    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
    `);
    const upsertMany = db.transaction(data => {
      for(const [key, val] of Object.entries(data)){
        if(DEFAULTS.hasOwnProperty(key)){
          upsert.run(key, String(val ?? ''));
        }
      }
    });
    upsertMany(req.body);
    db.prepare(
      `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
    ).run('UPDATE', 'settings', 0, 'Settings updated');
    res.json({ message: 'Settings saved successfully' });
  } catch(e) {
    res.status(500).json({ message: 'Error saving settings: ' + e.message });
  }
});

module.exports = router;
