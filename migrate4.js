const db = require('./database');

console.log('Running migration 4...');

const migrations = [
  `ALTER TABLE quotes ADD COLUMN imposition_type TEXT DEFAULT 'auto'`,
  `ALTER TABLE quotes ADD COLUMN plate_sets INTEGER DEFAULT 1`,
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

console.log('✅ Migration 4 complete!');
db.close();