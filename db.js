// db.js
const Database = require('better-sqlite3');

// Initialize DB
const db = new Database('comments.db');

// Create comments table without user join dependency
db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        postId TEXT NOT NULL,
        userId TEXT NOT NULL,
        content TEXT NOT NULL,
        positionArray TEXT,
        parentId INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parentId) REFERENCES comments (id)
    )
`);

module.exports = db;