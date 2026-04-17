const express = require('express');
const router = express.Router();
const db = require('../database');

// ── GET all suppliers ──────────────────────────────────
router.get('/', (req, res) => {
  const search = req.query.search || '';
  const rows = db.prepare(`
    SELECT * FROM suppliers
    WHERE active = 1
    AND (name LIKE ? OR supplier_id LIKE ? OR category LIKE ? OR contact_person LIKE ?)
    ORDER BY name ASC
  `).all(`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`);
  res.json(rows);
});

// ── GET single supplier ────────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(req.params.id);
  if(!row) return res.status(404).json({ message: 'Supplier not found' });
  res.json(row);
});

// ── Helper: generate next supplier ID ─────────────────
function nextSupplierId(){
  const last = db.prepare(
    `SELECT supplier_id FROM suppliers 
     WHERE supplier_id LIKE 'SUP-%' 
     ORDER BY id DESC LIMIT 1`
  ).get();
  if(!last) return 'SUP-0001';
  const num = parseInt(last.supplier_id.split('-')[1]) + 1;
  return `SUP-${String(num).padStart(4,'0')}`;
}

// ── POST create supplier ───────────────────────────────
router.post('/', (req, res) => {
  const { name, contact_person, phone, email, address, 
          category, default_markup, notes } = req.body;
  if(!name) return res.status(400).json({ message: 'Supplier name is required' });

  const supplier_id = nextSupplierId();

  try {
    const result = db.prepare(`
      INSERT INTO suppliers
        (supplier_id, name, contact_person, phone, email, 
         address, category, default_markup, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      supplier_id, name, contact_person||'', phone||'',
      email||'', address||'', category||'', 
      default_markup||15, notes||''
    );

    db.prepare(
      `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?, ?, ?, ?)`
    ).run('CREATE', 'suppliers', result.lastInsertRowid, 
      `Supplier ${supplier_id} — ${name} created`);

    res.json({ 
      id: result.lastInsertRowid, 
      supplier_id,
      message: 'Supplier created successfully' 
    });
  } catch(e){
    res.status(500).json({ message: 'Error creating supplier: ' + e.message });
  }
});

// ── PUT update supplier ────────────────────────────────
router.put('/:id', (req, res) => {
  const { name, contact_person, phone, email, address,
          category, default_markup, notes } = req.body;
  if(!name) return res.status(400).json({ message: 'Supplier name is required' });

  db.prepare(`
    UPDATE suppliers SET
      name=?, contact_person=?, phone=?, email=?,
      address=?, category=?, default_markup=?, notes=?
    WHERE id=?
  `).run(
    name, contact_person||'', phone||'', email||'',
    address||'', category||'', default_markup||15, 
    notes||'', req.params.id
  );

  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?, ?, ?, ?)`
  ).run('UPDATE', 'suppliers', req.params.id, `Supplier ${name} updated`);

  res.json({ message: 'Supplier updated successfully' });
});

// ── DELETE (deactivate) supplier ───────────────────────
router.delete('/:id', (req, res) => {
  db.prepare(`UPDATE suppliers SET active = 0 WHERE id = ?`).run(req.params.id);
  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?, ?, ?, ?)`
  ).run('DELETE', 'suppliers', req.params.id, `Supplier ${req.params.id} deactivated`);
  res.json({ message: 'Supplier deactivated successfully' });
});

module.exports = router;