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
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Database initialized successfully');
    }

    // User methods
    getUser(userId, callback) {
        this.db.get("SELECT * FROM users WHERE userId = ?", [userId], callback);
    }

    createUser(userId, callback) {
        this.db.run(
            "INSERT OR IGNORE INTO users (userId) VALUES (?)",
            [userId],
            callback
        );
    }

    countUsers(callback) {
        this.db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            callback(err, row ? row.count : 0);
        });
    }
}

// Promisified methods
Database.prototype.getUserAsync = function(userId) {
    return new Promise((resolve, reject) => {
        this.getUser(userId, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

Database.prototype.createUserAsync = function(userId) {
    return new Promise((resolve, reject) => {
        this.createUser(userId, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
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

module.exports = new Database();
