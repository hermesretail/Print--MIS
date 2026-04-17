const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM paper_stocks WHERE active=1 ORDER BY name ASC`).all();
  res.json(rows);
});

router.get('/all', (req, res) => {
  const rows = db.prepare(`SELECT * FROM paper_stocks ORDER BY name ASC`).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM paper_stocks WHERE id=?`).get(req.params.id);
  if(!row) return res.status(404).json({ message: 'Paper not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const {
    name, gsm, coating, parent_width, parent_height,
    cost_per_sheet, sheets_per_pack, pack_weight_kg,
    rate_per_kg, pricing_method, supplier_id, notes
  } = req.body;
  if(!name||!gsm) return res.status(400).json({ message: 'Name and GSM are required' });
  try {
    const result = db.prepare(`
      INSERT INTO paper_stocks (
        name, gsm, coating, parent_width, parent_height,
        cost_per_sheet, sheets_per_pack, pack_weight_kg,
        rate_per_kg, pricing_method, supplier_id, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      name, gsm, coating||'',
      parent_width||0, parent_height||0,
      cost_per_sheet||0, sheets_per_pack||500,
      pack_weight_kg||0, rate_per_kg||0,
      pricing_method||'per_sheet',
      supplier_id||null, notes||''
    );
    db.prepare(`INSERT INTO audit_log (action,table_name,record_id,details) VALUES (?,?,?,?)`)
      .run('CREATE','paper_stocks',result.lastInsertRowid,`Paper ${name} created`);
    res.json({ id: result.lastInsertRowid, message: 'Paper created successfully' });
  } catch(e){
    res.status(500).json({ message: 'Error: ' + e.message });
  }
});

router.put('/:id', (req, res) => {
  const {
    name, gsm, coating, parent_width, parent_height,
    cost_per_sheet, sheets_per_pack, pack_weight_kg,
    rate_per_kg, pricing_method, supplier_id, notes, active
  } = req.body;
  if(!name||!gsm) return res.status(400).json({ message: 'Name and GSM are required' });
  db.prepare(`
    UPDATE paper_stocks SET
      name=?, gsm=?, coating=?, parent_width=?, parent_height=?,
      cost_per_sheet=?, sheets_per_pack=?, pack_weight_kg=?,
      rate_per_kg=?, pricing_method=?, supplier_id=?, notes=?, active=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    name, gsm, coating||'',
    parent_width||0, parent_height||0,
    cost_per_sheet||0, sheets_per_pack||500,
    pack_weight_kg||0, rate_per_kg||0,
    pricing_method||'per_sheet',
    supplier_id||null, notes||'',
    active===false?0:1,
    req.params.id
  );
  db.prepare(`INSERT INTO audit_log (action,table_name,record_id,details) VALUES (?,?,?,?)`)
    .run('UPDATE','paper_stocks',req.params.id,`Paper ${name} updated`);
  res.json({ message: 'Paper updated successfully' });
});

router.delete('/:id', (req, res) => {
  db.prepare(`UPDATE paper_stocks SET active=0 WHERE id=?`).run(req.params.id);
  db.prepare(`INSERT INTO audit_log (action,table_name,record_id,details) VALUES (?,?,?,?)`)
    .run('DELETE','paper_stocks',req.params.id,`Paper deactivated`);
  res.json({ message: 'Paper deactivated' });
});

// Cut factor calculation endpoint
router.post('/cutfactor', (req, res) => {
  const { parentW, parentH, machineMaxW, machineMaxH } = req.body;
  if(!parentW||!parentH||!machineMaxW||!machineMaxH)
    return res.status(400).json({ message: 'All dimensions required' });
  const result = calcCutFactor(parentW, parentH, machineMaxW, machineMaxH);
  res.json(result);
});

function calcCutFactor(parentW, parentH, maxW, maxH){
  const fits = (w,h) => (w<=maxW&&h<=maxH)||(h<=maxW&&w<=maxH);

  // Full cut
  if(fits(parentW, parentH)){
    return { factor:'1/1', pressW:parentW, pressH:parentH, sheetsPerParent:1, label:'Full Sheet (1/1)' };
  }

  // Half cut — cut along long side
  const halfW = parentW/2, halfH = parentH/2;
  const longSide = parentW >= parentH ? 'width' : 'height';
  const hCutW = longSide==='width' ? halfW : parentW;
  const hCutH = longSide==='width' ? parentH : halfH;
  if(fits(hCutW, hCutH)){
    return { factor:'1/2', pressW:hCutW, pressH:hCutH, sheetsPerParent:2, label:'Half Cut (1/2)' };
  }

  // Quarter cut
  if(fits(halfW, halfH)){
    return { factor:'1/4', pressW:halfW, pressH:halfH, sheetsPerParent:4, label:'Quarter Cut (1/4)' };
  }

  // Does not fit at all
  return { factor:'none', pressW:parentW, pressH:parentH, sheetsPerParent:1, label:'Does not fit — outsource', warning:true };
}

module.exports = router;