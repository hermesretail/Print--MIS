const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database/moupress.db'));
db.pragma('journal_mode = WAL');

console.log('Running migration 2...');

const migrations = [
  `ALTER TABLE machines ADD COLUMN rate_low_col REAL DEFAULT 300`,
  `ALTER TABLE machines ADD COLUMN rate_low_col_add REAL DEFAULT 200`,
  `ALTER TABLE machines ADD COLUMN rate_high_col REAL DEFAULT 400`,
  `ALTER TABLE machines ADD COLUMN rate_high_col_add REAL DEFAULT 300`,
];

migrations.forEach(sql => {
  try {
    db.prepare(sql).run();
    console.log('✅ ' + sql.substring(0, 60));
  } catch(e) {
    if(e.message.includes('duplicate column')){
      console.log('⏭ Already exists — skipping');
    } else {
      console.log('⚠️ ' + e.message);
    }
  }
});

console.log('');
console.log('✅ Migration 2 complete!');
db.close();