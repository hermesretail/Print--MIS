const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database/moupress.db'));

db.pragma('journal_mode = WAL');

console.log('Running database migrations...');

const migrations = [
  // Add show_qty to quotes
  `ALTER TABLE quotes ADD COLUMN show_qty INTEGER DEFAULT 3`,
  // Add breakdown column if missing
  `ALTER TABLE quotes ADD COLUMN breakdown TEXT`,
  // Add new machine fields
  `ALTER TABLE machines ADD COLUMN max_sheet_w REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN max_sheet_h REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN min_sheet_w REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN min_sheet_h REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN max_print_w REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN max_print_h REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN plate_w REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN plate_h REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN plate_cost REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN rate_1col REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN rate_4col REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN rate_5col REAL DEFAULT 0`,
  `ALTER TABLE machines ADD COLUMN charge_mode TEXT DEFAULT 'per1000'`,
];

migrations.forEach(sql => {
  try {
    db.prepare(sql).run();
    console.log('✅ ' + sql.substring(0, 60));
  } catch(e) {
    if(e.message.includes('duplicate column')) {
      console.log('⏭ Already exists — skipping');
    } else {
      console.log('⚠️ ' + e.message);
    }
  }
});

console.log('');
console.log('✅ Migration complete!');
db.close();