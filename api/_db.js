const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.VERCEL ? '/tmp/voidlure.db' : path.join(__dirname, '../data/voidlure.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      tier TEXT DEFAULT 'free',
      isAdmin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      original_url TEXT NOT NULL,
      short_url TEXT NOT NULL,
      provider TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@voidlure.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'Admin@2026';

  db.get('SELECT * FROM users WHERE email = ?', [adminEmail], (err, row) => {
    if (!row) {
      const hashed = bcrypt.hashSync(adminPass, 10);
      db.run(
        'INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, ?)',
        ['System Admin', adminEmail, hashed, 1]
      );
    }
  });
});

module.exports = db;
