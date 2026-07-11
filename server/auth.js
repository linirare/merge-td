const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'merge-td-dev-secret-change-in-production';

function signToken(uid) {
  return jwt.sign({ uid }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch (e) { return null; }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.uid = payload.uid;
  next();
}

module.exports = { signToken, verifyToken, authMiddleware, JWT_SECRET };
