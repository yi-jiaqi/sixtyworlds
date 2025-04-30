const Database = require('better-sqlite3');

// Initialize DB
const db = new Database('comments.db');

// Create comments table (unchanged from your original)
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

// New scenes table with proper relations
db.exec(`
    CREATE TABLE IF NOT EXISTS scenes (
        serial INTEGER PRIMARY KEY AUTOINCREMENT,
        sequence INTEGER NOT NULL,
        commentId TEXT NOT NULL,
        position TEXT NOT NULL,  -- Stored as JSON string
        rotation TEXT NOT NULL,  -- Stored as JSON string
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (commentId) REFERENCES comments(id) ON DELETE CASCADE
    )
`);

module.exports = db;