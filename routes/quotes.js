const express = require('express');
const router = express.Router();
const db = require('../database');

function nextQuoteNo(){
  const year = new Date().getFullYear();
  const last = db.prepare(
    `SELECT quote_no FROM quotes WHERE quote_no LIKE ? ORDER BY id DESC LIMIT 1`
  ).get(`Q-${year}-%`);
  if(!last) return `Q-${year}-0001`;
  const num = parseInt(last.quote_no.split('-')[2]) + 1;
  return `Q-${year}-${String(num).padStart(4,'0')}`;
}

// Best fit imposition — runs both scenarios and picks winner
function calcBestFit(sheetW, sheetH, pageW, pageH, strictGrain=false){
  const BLEED = 5;
  const GRIPPER = 10;
  const pw = pageW + (BLEED * 2);
  const ph = pageH + (BLEED * 2);
  const uw = sheetW - GRIPPER;
  const uh = sheetH - GRIPPER;

  // Scenario A — standard alignment
  const aH = Math.floor(uw / pw);
  const aV = Math.floor(uh / ph);
  const totalA = aH * aV;

  // Scenario B — rotated 90°
  const bH = Math.floor(uw / ph);
  const bV = Math.floor(uh / pw);
  const totalB = bH * bV;

  let useScenario;
  if(strictGrain){
    useScenario = 'A';
  } else {
    useScenario = totalB > totalA ? 'B' : 'A';
  }

  const cols = useScenario === 'A' ? aH : bH;
  const rows = useScenario === 'A' ? aV : bV;
  const ups = Math.max(cols * rows, 1);
  const pagesPerSide = ups;
  const pagesPerPlateSet = pagesPerSide * 2;

  return {
    ups,
    cols,
    rows,
    scenario: useScenario,
    totalA,
    totalB,
    pagesPerSide,
    pagesPerPlateSet,
    itemW: useScenario === 'A' ? pw : ph,
    itemH: useScenario === 'A' ? ph : pw,
    usableW: uw,
    usableH: uh,
    sheetW,
    sheetH
  };
}

// Calculate plate sets and total plates
function calcPlates(totalPages, pagesPerPlateSet, colours){
  const plateSets = Math.ceil(totalPages / pagesPerPlateSet);
  const totalPlates = plateSets * colours;
  const makereadySheets = plateSets * 100;
  return { plateSets, totalPlates, makereadySheets };
}

router.get('/', (req, res) => {
  const search = req.query.search || '';
  const status = req.query.status || '';
  let query = `
    SELECT q.*, c.name as customer_name, c.customer_id as cust_code
    FROM quotes q
    LEFT JOIN customers c ON q.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if(search){
    query += ` AND (q.quote_no LIKE ? OR c.name LIKE ? OR q.cash_customer_name LIKE ? OR q.job_type LIKE ?)`;
    params.push(`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`);
  }
  if(status){
    query += ` AND q.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY q.id DESC`;
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT q.*, c.name as customer_name, c.customer_id as cust_code,
           c.phone as cust_phone, c.email as cust_email, c.address as cust_address
    FROM quotes q
    LEFT JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ?
  `).get(req.params.id);
  if(!row) return res.status(404).json({ message: 'Quote not found' });
  if(row.specs) row.specs = JSON.parse(row.specs);
  if(row.breakdown) row.breakdown = JSON.parse(row.breakdown);
  res.json(row);
});

router.post('/', (req, res) => {
  const {
    customer_id, cash_customer_name, job_type, print_method,
    specs, qty1, qty2, qty3, total1, total2, total3,
    markup_percent, notes, expiry_days,
    breakdown1, breakdown2, breakdown3
  } = req.body;

  if(!job_type || !print_method){
    return res.status(400).json({ message: 'Job type and print method are required' });
  }

  const quote_no = nextQuoteNo();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (expiry_days||30));
  const expiry_date = expiry.toISOString().slice(0,10);

  try {
    const result = db.prepare(`
      INSERT INTO quotes (
        quote_no, customer_id, cash_customer_name, job_type, print_method,
        specs, qty1, qty2, qty3, total1, total2, total3,
        markup_percent, status, expiry_date, notes, show_qty, breakdown
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'Draft',?,?,3,?)
    `).run(
      quote_no,
      customer_id||null, cash_customer_name||'',
      job_type, print_method,
      JSON.stringify(specs||{}),
      qty1||0, qty2||0, qty3||0,
      total1||0, total2||0, total3||0,
      markup_percent||30,
      expiry_date, notes||'',
      JSON.stringify({
        qty1: breakdown1||[],
        qty2: breakdown2||[],
        qty3: breakdown3||[]
      })
    );

    db.prepare(
      `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
    ).run('CREATE','quotes',result.lastInsertRowid,`Quote ${quote_no} created`);

    res.json({ id: result.lastInsertRowid, quote_no, message: 'Quote created successfully' });
  } catch(e){
    res.status(500).json({ message: 'Error creating quote: ' + e.message });
  }
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['Draft','Sent','Accepted','Rejected','Expired'];
  if(!allowed.includes(status)){
    return res.status(400).json({ message: 'Invalid status' });
  }
  db.prepare(`UPDATE quotes SET status=? WHERE id=?`).run(status, req.params.id);
  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
  ).run('UPDATE','quotes',req.params.id,`Quote status changed to ${status}`);
  res.json({ message: 'Status updated successfully' });
});

router.put('/:id', (req, res) => {
  const {
    customer_id, cash_customer_name, job_type, print_method,
    specs, qty1, qty2, qty3, total1, total2, total3,
    markup_percent, notes, expiry_date,
    breakdown1, breakdown2, breakdown3
  } = req.body;

  db.prepare(`
    UPDATE quotes SET
      customer_id=?, cash_customer_name=?, job_type=?, print_method=?,
      specs=?, qty1=?, qty2=?, qty3=?, total1=?, total2=?, total3=?,
      markup_percent=?, notes=?, expiry_date=?, show_qty=3, breakdown=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    customer_id||null, cash_customer_name||'',
    job_type, print_method,
    JSON.stringify(specs||{}),
    qty1||0, qty2||0, qty3||0,
    total1||0, total2||0, total3||0,
    markup_percent||30, notes||'', expiry_date||'',
    JSON.stringify({
      qty1: breakdown1||[],
      qty2: breakdown2||[],
      qty3: breakdown3||[]
    }),
    req.params.id
  );

  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
  ).run('UPDATE','quotes',req.params.id,`Quote ${req.params.id} updated`);

  res.json({ message: 'Quote updated successfully' });
});

router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM quotes WHERE id=?`).run(req.params.id);
  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
  ).run('DELETE','quotes',req.params.id,`Quote ${req.params.id} deleted`);
  res.json({ message: 'Quote deleted successfully' });
});

// Imposition calculation endpoint
router.post('/imposition', (req, res) => {
  const { sheetW, sheetH, pageW, pageH, strictGrain } = req.body;
  if(!sheetW||!sheetH||!pageW||!pageH){
    return res.status(400).json({ message: 'All dimensions required' });
  }
  const result = calcBestFit(sheetW, sheetH, pageW, pageH, strictGrain||false);
  res.json(result);
});

// Plate calculation endpoint
router.post('/plates', (req, res) => {
  const { sheetW, sheetH, pageW, pageH, totalPages, colours, strictGrain } = req.body;
  if(!sheetW||!sheetH||!pageW||!pageH){
    return res.status(400).json({ message: 'All dimensions required' });
  }
  const imp = calcBestFit(sheetW, sheetH, pageW, pageH, strictGrain||false);
  const plates = calcPlates(totalPages||1, imp.pagesPerPlateSet, colours||1);
  res.json({ ...imp, ...plates });
});

module.exports = { router, calcBestFit, calcPlates };