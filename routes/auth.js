const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const SECRET = 'MouPressSecret2026!';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if(!username || !password){
    return res.status(400).json({ message: 'Username and password required' });
  }

  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? AND active = 1'
  ).get(username);

  if(!user){
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if(!valid){
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '8h' }
  );

  // Log the login
  db.prepare(
    'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)'
  ).run(user.id, 'LOGIN', `User ${user.username} logged in`);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;