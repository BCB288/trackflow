const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');
const { hashPassword, verifyPassword, generateToken, ROLES } = require('../services/auth');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, full_name, created_at, last_login FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.post('/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, role, fullName } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password, and role required' });
    }
    if (!ROLES[role]) {
      return res.status(400).json({ error: `Invalid role. Valid: ${Object.keys(ROLES).join(', ')}` });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const id = uuidv4();
    const passwordHash = await hashPassword(password);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, full_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, passwordHash, role, fullName || null);

    res.status(201).json({ id, username, role, fullName });
  } catch (err) {
    console.error('[AUTH] Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role, full_name, is_active, created_at, last_login FROM users').all();
  res.json({ users });
});

module.exports = router;
