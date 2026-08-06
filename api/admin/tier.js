const db = require('../_db');
const jwt = require('jsonwebtoken');

function isAdmin(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    return decoded.isAdmin === true;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = req.url.split('/').pop();
  const { tier } = req.body;

  if (!tier || !['free', 'vip'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  db.run('UPDATE users SET tier = ? WHERE id = ?', [tier, id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, tier });
  });
};
