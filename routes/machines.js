const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM machines ORDER BY type ASC, name ASC`).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(req.params.id);
  if(!row) return res.status(404).json({ message: 'Machine not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, type, hourly_rate, speed, speed_unit, click_charge_bw,
    click_charge_colour, notes, max_sheet_w, max_sheet_h, min_sheet_w,
    min_sheet_h, max_print_w, max_print_h, plate_w, plate_h, plate_cost,
    rate_low_col, rate_low_col_add, rate_high_col, rate_high_col_add,
    charge_mode } = req.body;
  if(!name || !type) return res.status(400).json({ message: 'Name and type are required' });

  try {
    const result = db.prepare(`
      INSERT INTO machines (name, type, hourly_rate, speed, speed_unit,
        click_charge, notes, max_sheet_w, max_sheet_h, min_sheet_w, min_sheet_h,
        max_print_w, max_print_h, plate_w, plate_h, plate_cost,
        rate_low_col, rate_low_col_add, rate_high_col, rate_high_col_add,
        rate_1col, rate_4col, rate_5col, charge_mode)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(name, type, hourly_rate||0, speed||0, speed_unit||'sheets/hr',
        click_charge_bw||0, notes||'',
        max_sheet_w||0, max_sheet_h||0, min_sheet_w||0, min_sheet_h||0,
        max_print_w||0, max_print_h||0, plate_w||0, plate_h||0, plate_cost||0,
        rate_low_col||300, rate_low_col_add||200,
        rate_high_col||400, rate_high_col_add||300,
        rate_low_col||300, rate_high_col||400, rate_high_col||400,
        charge_mode||'per1000');

    db.prepare(`INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`)
      .run('CREATE', 'machines', result.lastInsertRowid, `Machine ${name} created`);

    res.json({ id: result.lastInsertRowid, message: 'Machine created successfully' });
  } catch(e) {
    res.status(500).json({ message: 'Error: ' + e.message });
  }
});

router.put('/:id', (req, res) => {
  const { name, type, hourly_rate, speed, speed_unit, click_charge_bw,
    click_charge_colour, notes, active, max_sheet_w, max_sheet_h,
    min_sheet_w, min_sheet_h, max_print_w, max_print_h, plate_w, plate_h,
    plate_cost, rate_low_col, rate_low_col_add, rate_high_col,
    rate_high_col_add, charge_mode } = req.body;
  if(!name || !type) return res.status(400).json({ message: 'Name and type are required' });

  db.prepare(`
    UPDATE machines SET name=?, type=?, hourly_rate=?, speed=?, speed_unit=?,
      click_charge=?, notes=?, active=?,
      max_sheet_w=?, max_sheet_h=?, min_sheet_w=?, min_sheet_h=?,
      max_print_w=?, max_print_h=?, plate_w=?, plate_h=?, plate_cost=?,
      rate_low_col=?, rate_low_col_add=?, rate_high_col=?, rate_high_col_add=?,
      rate_1col=?, rate_4col=?, rate_5col=?, charge_mode=?
    WHERE id=?
  `).run(name, type, hourly_rate||0, speed||0, speed_unit||'sheets/hr',
      click_charge_bw||0, notes||'', active===false?0:1,
      max_sheet_w||0, max_sheet_h||0, min_sheet_w||0, min_sheet_h||0,
      max_print_w||0, max_print_h||0, plate_w||0, plate_h||0, plate_cost||0,
      rate_low_col||300, rate_low_col_add||200,
      rate_high_col||400, rate_high_col_add||300,
      rate_low_col||300, rate_high_col||400, rate_high_col||400,
      charge_mode||'per1000', req.params.id);

  db.prepare(`INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`)
    .run('UPDATE', 'machines', req.params.id, `Machine ${name} updated`);

  res.json({ message: 'Machine updated successfully' });
});

router.delete('/:id', (req, res) => {
  db.prepare(`UPDATE machines SET active = 0 WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`)
    .run('DELETE', 'machines', req.params.id, `Machine deactivated`);
  res.json({ message: 'Machine deactivated successfully' });
});

module.exports = router;