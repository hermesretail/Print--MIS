const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../database/moupress.db'));
db.pragma('journal_mode = WAL');

console.log('Running migration 3 — parent sheet dimensions...');

try {
  // SQLite does not support RENAME COLUMN in older versions
  // So we recreate the paper_stocks table with new column names

  // Step 1: get existing data
  const rows = db.prepare(`SELECT * FROM paper_stocks`).all();
  console.log(`Found ${rows.length} existing paper records`);

  // Step 2: create new table with parent_width / parent_height
  db.prepare(`CREATE TABLE IF NOT EXISTS paper_stocks_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gsm INTEGER NOT NULL,
    coating TEXT DEFAULT '',
    parent_width REAL DEFAULT 0,
    parent_height REAL DEFAULT 0,
    cost_per_sheet REAL DEFAULT 0,
    sheets_per_pack INTEGER DEFAULT 500,
    pack_weight_kg REAL DEFAULT 0,
    rate_per_kg REAL DEFAULT 0,
    pricing_method TEXT DEFAULT 'per_sheet',
    supplier_id INTEGER,
    notes TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  // Step 3: copy data — map sheet_width/height to parent_width/height
  const insert = db.prepare(`
    INSERT INTO paper_stocks_new (
      id, name, gsm, coating,
      parent_width, parent_height,
      cost_per_sheet, sheets_per_pack, pack_weight_kg,
      rate_per_kg, pricing_method, supplier_id, notes, active,
      created_at, updated_at
    ) VALUES (
      @id, @name, @gsm, @coating,
      @parent_width, @parent_height,
      @cost_per_sheet, @sheets_per_pack, @pack_weight_kg,
      @rate_per_kg, @pricing_method, @supplier_id, @notes, @active,
      @created_at, @updated_at
    )
  `);

  const insertMany = db.transaction(rows => {
    for(const row of rows){
      insert.run({
        id: row.id,
        name: row.name,
        gsm: row.gsm,
        coating: row.coating||'',
        parent_width: row.sheet_width||row.parent_width||0,
        parent_height: row.sheet_height||row.parent_height||0,
        cost_per_sheet: row.cost_per_sheet||0,
        sheets_per_pack: row.sheets_per_pack||500,
        pack_weight_kg: row.pack_weight_kg||0,
        rate_per_kg: row.rate_per_kg||0,
        pricing_method: row.pricing_method||'per_sheet',
        supplier_id: row.supplier_id||null,
        notes: row.notes||'',
        active: row.active===undefined?1:row.active,
        created_at: row.created_at||new Date().toISOString(),
        updated_at: row.updated_at||new Date().toISOString()
      });
    }
  });

  insertMany(rows);
  console.log(`✅ Copied ${rows.length} records`);

  // Step 4: drop old table, rename new
  db.prepare(`DROP TABLE paper_stocks`).run();
  db.prepare(`ALTER TABLE paper_stocks_new RENAME TO paper_stocks`).run();
  console.log('✅ Table renamed successfully');

  console.log('');
  console.log('✅ Migration 3 complete!');
} catch(e){
  console.log('❌ Error: ' + e.message);
}

db.close();