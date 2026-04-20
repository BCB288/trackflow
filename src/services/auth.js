const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'trackflow-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = 10;

const ROLES = {
  admin: { level: 3, label: 'Administrateur' },
  operator: { level: 2, label: 'Opérateur scan' },
  readonly: { level: 1, label: 'Lecture seule' },
};

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken, ROLES, JWT_SECRET };
