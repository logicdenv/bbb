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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  db.get('SELECT COUNT(*) as total FROM users', (err, userCount) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    db.get('SELECT COUNT(*) as vip FROM users WHERE tier = "vip"', (err, vipCount) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      db.get('SELECT COUNT(*) as links FROM links', (err, linkCount) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        res.json({
          totalUsers: userCount.total,
          vipUsers: vipCount.vip,
          freeUsers: userCount.total - vipCount.vip,
          totalLinks: linkCount.links || 0
        });
      });
    });
  });
};
