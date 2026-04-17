const express = require('express');
const router = express.Router();
const db = require('../database');

// ── Helper: generate next customer ID ─────────────────
function nextCustomerId(){
  const last = db.prepare(
    `SELECT customer_id FROM customers 
     WHERE customer_id LIKE 'CUST-%' 
     ORDER BY id DESC LIMIT 1`
  ).get();
  if(!last) return 'CUST-0001';
  const num = parseInt(last.customer_id.split('-')[1]) + 1;
  return `CUST-${String(num).padStart(4,'0')}`;
}

// ── GET all customers ──────────────────────────────────
router.get('/', (req, res) => {
  const search = req.query.search || '';
  const rows = db.prepare(`
    SELECT * FROM customers 
    WHERE active = 1 
    AND (name LIKE ? OR customer_id LIKE ? OR phone LIKE ? OR email LIKE ?)
    ORDER BY name ASC
  `).all(`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`);
  res.json(rows);
});

// ── GET single customer ────────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT * FROM customers WHERE id = ?`
  ).get(req.params.id);
  if(!row) return res.status(404).json({ message: 'Customer not found' });
  res.json(row);
});

// ── POST create customer ───────────────────────────────
router.post('/', (req, res) => {
  const { name, phone, email, address, markup_percent, cash_only } = req.body;
  if(!name) return res.status(400).json({ message: 'Customer name is required' });

  const customer_id = cash_only ? 'CASH' : nextCustomerId();

  try {
    const result = db.prepare(`
      INSERT INTO customers 
        (customer_id, name, phone, email, address, markup_percent, cash_only)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer_id, name, phone||'', email||'', 
      address||'', markup_percent||30, cash_only?1:0
    );

    // Audit log
    db.prepare(
      `INSERT INTO audit_log (action, table_name, record_id, details) 
       VALUES (?, ?, ?, ?)`
    ).run('CREATE', 'customers', result.lastInsertRowid, 
      `Customer ${customer_id} — ${name} created`);

    res.json({ 
      id: result.lastInsertRowid, 
      customer_id, 
      message: 'Customer created successfully' 
    });
  } catch(e){
    res.status(500).json({ message: 'Error creating customer: ' + e.message });
  }
});

// ── PUT update customer ────────────────────────────────
router.put('/:id', (req, res) => {
  const { name, phone, email, address, markup_percent } = req.body;
  if(!name) return res.status(400).json({ message: 'Customer name is required' });

  db.prepare(`
    UPDATE customers 
    SET name=?, phone=?, email=?, address=?, markup_percent=?
    WHERE id=?
  `).run(name, phone||'', email||'', address||'', markup_percent||30, req.params.id);

  // Audit log
  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) 
     VALUES (?, ?, ?, ?)`
  ).run('UPDATE', 'customers', req.params.id, `Customer ${req.params.id} updated`);

  res.json({ message: 'Customer updated successfully' });
});

// ── DELETE (deactivate) customer ───────────────────────
router.delete('/:id', (req, res) => {
  db.prepare(
    `UPDATE customers SET active = 0 WHERE id = ?`
  ).run(req.params.id);

  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) 
     VALUES (?, ?, ?, ?)`
  ).run('DELETE', 'customers', req.params.id, `Customer ${req.params.id} deactivated`);

  res.json({ message: 'Customer deactivated successfully' });
});

module.exports = router;