const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Pastikan folder data ada
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class Database {
  constructor() {
    this.dbPath = path.join(dataDir, 't-ai.db');
    this.db = new sqlite3.Database(this.dbPath);
    this.init();
  }

  init() {
    console.log('📊 Initializing SQLite database...');
    
    this.db.serialize(() => {
      // Tabel users
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT UNIQUE,
          name TEXT,
          role TEXT DEFAULT 'USER',
          banned INTEGER DEFAULT 0,
          banReason TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabel commands (untuk custom commands)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS commands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE,
          response TEXT,
          category TEXT,
          createdBy TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabel groups
      this.db.run(`
        CREATE TABLE IF NOT EXISTS groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          groupId TEXT UNIQUE,
          name TEXT,
          owner TEXT,
          enabled INTEGER DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('✅ Database initialized successfully');
    });
  }

  // User methods
  async getUser(userId) {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createUser(userId, data = {}) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT OR IGNORE INTO users (userId, name, role) VALUES (?, ?, ?)",
        [userId, data.name || '', data.role || 'USER'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async updateUserLastSeen(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE users SET lastSeen = CURRENT_TIMESTAMP WHERE userId = ?",
        [userId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  async countUsers() {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  // Command methods
  async getCommand(name) {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM commands WHERE name = ?", [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createCommand(name, response, category = 'custom', createdBy = 'system') {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT OR REPLACE INTO commands (name, response, category, createdBy) VALUES (?, ?, ?, ?)",
        [name, response, category, createdBy],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // Group methods
  async getGroup(groupId) {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM groups WHERE groupId = ?", [groupId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createGroup(groupId, name, owner) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT OR IGNORE INTO groups (groupId, name, owner) VALUES (?, ?, ?)",
        [groupId, name, owner],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // Close connection
  close() {
    this.db.close();
  }
}

module.exports = new Database();
