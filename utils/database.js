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

    console.log('✅ Database initialized successfully');
  }

  // User methods
  getUser(userId, callback) {
    this.db.get("SELECT * FROM users WHERE userId = ?", [userId], callback);
  }

  createUser(userId, data = {}, callback) {
    this.db.run(
      "INSERT OR IGNORE INTO users (userId, name, role) VALUES (?, ?, ?)",
      [userId, data.name || '', data.role || 'USER'],
      callback
    );
  }

  updateUserLastSeen(userId, callback) {
    this.db.run(
      "UPDATE users SET lastSeen = CURRENT_TIMESTAMP WHERE userId = ?",
      [userId],
      callback
    );
  }

  countUsers(callback) {
    this.db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
      callback(err, row ? row.count : 0);
    });
  }

  // Command methods
  getCommand(name, callback) {
    this.db.get("SELECT * FROM commands WHERE name = ?", [name], callback);
  }

  createCommand(name, response, category = 'custom', createdBy = 'system', callback) {
    this.db.run(
      "INSERT OR REPLACE INTO commands (name, response, category, createdBy) VALUES (?, ?, ?, ?)",
      [name, response, category, createdBy],
      callback
    );
  }

  // Close connection
  close() {
    this.db.close();
  }
}

// Promisified methods untuk async/await
Database.prototype.getUserAsync = function(userId) {
  return new Promise((resolve, reject) => {
    this.getUser(userId, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

Database.prototype.createUserAsync = function(userId, data = {}) {
  return new Promise((resolve, reject) => {
    this.createUser(userId, data, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

Database.prototype.updateUserLastSeenAsync = function(userId) {
  return new Promise((resolve, reject) => {
    this.updateUserLastSeen(userId, function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

Database.prototype.countUsersAsync = function() {
  return new Promise((resolve, reject) => {
    this.countUsers((err, count) => {
      if (err) reject(err);
      else resolve(count);
    });
  });
};

Database.prototype.getCommandAsync = function(name) {
  return new Promise((resolve, reject) => {
    this.getCommand(name, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

Database.prototype.createCommandAsync = function(name, response, category = 'custom', createdBy = 'system') {
  return new Promise((resolve, reject) => {
    this.createCommand(name, response, category, createdBy, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

module.exports = new Database();
