const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');

// ── GET all users ──────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, username, full_name, email, role, active, last_login, created_at
      FROM users ORDER BY id ASC
    `).all();
    res.json(rows);
  } catch(e) {
    res.status(500).json({ message: 'Error loading users: ' + e.message });
  }
});

// ── GET single user ────────────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT id, username, full_name, email, role, active, last_login, created_at
    FROM users WHERE id = ?
  `).get(req.params.id);
  if(!row) return res.status(404).json({ message: 'User not found' });
  res.json(row);
});

// ── POST create user ───────────────────────────────────
router.post('/', async (req, res) => {
  const { username, full_name, email, role, password, active } = req.body;
  if(!username || !full_name || !password){
    return res.status(400).json({ message: 'Username, full name, and password are required' });
  }
  if(password.length < 8){
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  // Check username unique
  const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if(existing) return res.status(400).json({ message: 'Username already exists' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(`
      INSERT INTO users (username, full_name, email, role, password_hash, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, full_name, email||'', role||'Staff', hash, active===false?0:1);

    db.prepare(
      `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
    ).run('CREATE', 'users', result.lastInsertRowid, `User ${username} created`);

    res.json({ id: result.lastInsertRowid, message: 'User created successfully' });
  } catch(e) {
    res.status(500).json({ message: 'Error creating user: ' + e.message });
  }
});

// ── PUT update user ────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { full_name, email, role, password, active } = req.body;
  if(!full_name){
    return res.status(400).json({ message: 'Full name is required' });
  }
  try {
    if(password && password.length > 0){
      if(password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
      const hash = await bcrypt.hash(password, 10);
      db.prepare(`
        UPDATE users SET full_name=?, email=?, role=?, active=?, password_hash=?
        WHERE id=?
      `).run(full_name, email||'', role||'Staff', active===false?0:1, hash, req.params.id);
    } else {
      db.prepare(`
        UPDATE users SET full_name=?, email=?, role=?, active=?
        WHERE id=?
      `).run(full_name, email||'', role||'Staff', active===false?0:1, req.params.id);
    }
    db.prepare(
      `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
    ).run('UPDATE', 'users', req.params.id, `User ${req.params.id} updated`);
    res.json({ message: 'User updated successfully' });
  } catch(e) {
    res.status(500).json({ message: 'Error updating user: ' + e.message });
  }
});

// ── POST change own password ───────────────────────────
router.post('/change-password', async (req, res) => {
  // In a real system, the auth middleware would provide req.user.id
  // For now we look up via the token or require username in body
  const { current_password, new_password, username } = req.body;
  if(!current_password || !new_password){
    return res.status(400).json({ message: 'Current and new password are required' });
  }
  if(new_password.length < 8){
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }
  // Get user — in real system use auth middleware; here look up from Authorization header JWT
  // Minimal approach: look up by username provided, or decode basic JWT
  try {
    // Try to decode the JWT to get username
    const authHeader = req.headers['authorization']||'';
    const tokenStr = authHeader.replace('Bearer ','');
    // JWT payload is base64 encoded middle section
    const payload = JSON.parse(Buffer.from(tokenStr.split('.')[1], 'base64').toString());
    const uname = payload.username || payload.user || username;
    if(!uname) return res.status(400).json({ message: 'Could not identify user' });

    const u = db.prepare(`SELECT * FROM users WHERE username = ?`).get(uname);
    if(!u) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(current_password, u.password_hash);
    if(!match) return res.status(401).json({ message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    db.prepare(`UPDATE users SET password_hash = ? WHERE username = ?`).run(hash, uname);
    db.prepare(
      `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
    ).run('UPDATE', 'users', u.id, `User ${uname} changed password`);

    res.json({ message: 'Password changed successfully' });
  } catch(e) {
    res.status(500).json({ message: 'Error changing password: ' + e.message });
  }
});

// ── DELETE deactivate ──────────────────────────────────
router.delete('/:id', (req, res) => {
  db.prepare(`UPDATE users SET active = 0 WHERE id = ?`).run(req.params.id);
  db.prepare(
    `INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?,?,?,?)`
  ).run('DELETE', 'users', req.params.id, `User deactivated`);
  res.json({ message: 'User deactivated' });
});

module.exports = router;
