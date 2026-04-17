const express = require('express');
const router = express.Router();
const db = require('../database');

// ── GET all finishing ops ──────────────────────────────
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM finishing_ops ORDER BY category ASC, name ASC
  `).all();
  res.json(rows);
});

// ── GET single finishing op ────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM finishing_ops WHERE id = ?`).get(req.params.id);
  if(!row) return res.status(404).json({ message: 'Finishing operation not found' });
  res.json(row);
});

// ── POST create finishing op ───────────────────────────
router.post('/', (req, res) => {
  const { name, category, rate, rate_unit, notes } = req.body;
  if(!name||!category||!rate_unit){
    return res.status(400).json({ message: 'Name, category and rate unit are required' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO finishing_ops (name, category, rate, rate_unit, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, category, rate||0, rate_unit, notes||'');

    db.prepare(
      `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?, ?, ?, ?)`
    ).run('CREATE', 'finishing_ops', result.lastInsertRowid, `Finishing op ${name} created`);

    res.json({ id: result.lastInsertRowid, message: 'Finishing operation created successfully' });
  } catch(e){
    res.status(500).json({ message: 'Error creating finishing op: ' + e.message });
  }
});

// ── PUT update finishing op ────────────────────────────
router.put('/:id', (req, res) => {
  const { name, category, rate, rate_unit, notes, active } = req.body;
  if(!name||!category||!rate_unit){
    return res.status(400).json({ message: 'Name, category and rate unit are required' });
  }
  db.prepare(`
    UPDATE finishing_ops SET name=?, category=?, rate=?, rate_unit=?, notes=?, active=?
    WHERE id=?
  `).run(name, category, rate||0, rate_unit, notes||'', active===false?0:1, req.params.id);

  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?, ?, ?, ?)`
  ).run('UPDATE', 'finishing_ops', req.params.id, `Finishing op ${name} updated`);

  res.json({ message: 'Finishing operation updated successfully' });
});

// ── DELETE (deactivate) finishing op ──────────────────
router.delete('/:id', (req, res) => {
  db.prepare(`UPDATE finishing_ops SET active = 0 WHERE id = ?`).run(req.params.id);
  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?, ?, ?, ?)`
  ).run('DELETE', 'finishing_ops', req.params.id, `Finishing op ${req.params.id} deactivated`);
  res.json({ message: 'Finishing operation deactivated successfully' });
});

module.exports = router;