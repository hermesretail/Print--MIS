const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const db = require('./database');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const machineRoutes = require('./routes/machines');
const paperRoutes = require('./routes/paper');
const supplierRoutes = require('./routes/suppliers');
const finishingRoutes = require('./routes/finishing');
const { router: quoteRoutes } = require('./routes/quotes');
const settingsRoutes = require('./routes/settings');
const userRoutes     = require('./routes/users');

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/paper', paperRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/finishing', finishingRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users',    userRoutes);

app.get('/api/dashboard/stats', (req, res) => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const acceptedVal = db.prepare(
    `SELECT COALESCE(SUM(total1),0) as v FROM quotes WHERE status='Accepted' AND created_at >= ?`
  ).get(monthStart)?.v || 0;
  res.json({
    quotesThisMonth:   db.prepare(`SELECT COUNT(*) as c FROM quotes WHERE created_at >= ?`).get(monthStart)?.c || 0,
    pendingQuotes:     db.prepare(`SELECT COUNT(*) as c FROM quotes WHERE status = 'Sent'`).get()?.c || 0,
    acceptedThisMonth: db.prepare(`SELECT COUNT(*) as c FROM quotes WHERE status = 'Accepted' AND created_at >= ?`).get(monthStart)?.c || 0,
    totalCustomers:    db.prepare(`SELECT COUNT(*) as c FROM customers WHERE active = 1`).get()?.c || 0,
    acceptedValue:     acceptedVal
  });
});
app.get('/api/dashboard/recent-quotes', (req, res) => {
  const rows = db.prepare(`
    SELECT q.id, q.quote_no, q.status, q.total1, q.cash_customer_name, q.job_type,
           JSON_EXTRACT(q.specs, '$.jobDesc') as job_desc,
           c.name as customer_name
    FROM quotes q
    LEFT JOIN customers c ON q.customer_id = c.id
    ORDER BY q.created_at DESC LIMIT 8
  `).all();
  res.json(rows);
});
app.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    message: '✅ Mou Press MIS Server is running!',
    database: '✅ Connected'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('✅ Mou Press MIS running on http://localhost:3000');
  console.log('✅ Other computers can access via your IP address');
  console.log('');
});