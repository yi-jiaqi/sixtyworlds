const Database = require('better-sqlite3');

// Initialize DB (named as 'comments.db' but for comments + scenes)
const db = new Database('comments.db');

// Correct the tables structure
db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial TEXT NOT NULL,
        userId TEXT NOT NULL,
        content TEXT NOT NULL,
        positionArray TEXT,
        parentId INTEGER,
        attachScene BOOLEAN DEFAULT 0,
        associatedSceneId INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parentId) REFERENCES comments (id),
        FOREIGN KEY (associatedSceneId) REFERENCES scenes(sceneId)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS scenes (
        sceneId INTEGER PRIMARY KEY AUTOINCREMENT,
        serial INTEGER NOT NULL,
        sequence INTEGER,
        associatedCommentId INTEGER,
        position TEXT NOT NULL,
        rotation TEXT NOT NULL,
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (associatedCommentId) REFERENCES comments(id) ON DELETE CASCADE
    )
`);

// Update scene functions
function addScene(serial, sequence, commentId = null, position, rotation, name) {
    const stmt = db.prepare(`
        INSERT INTO scenes (
            serial, 
            sequence, 
            associatedCommentId, 
            position, 
            rotation, 
            name
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(serial, sequence, commentId, position, rotation, name);
}

function getSceneById(sceneId) {
    const stmt = db.prepare(`
        SELECT 
            sceneId,
            serial,
            sequence,
            associatedCommentId,
            position,
            rotation,
            name,
            createdAt
        FROM scenes 
        WHERE sceneId = ?
    `);
    const scene = stmt.get(sceneId);
    if (scene) {
        scene.position = JSON.parse(scene.position);
        scene.rotation = JSON.parse(scene.rotation);
    }
    return scene;
}

function getScenesBySerial(serial) {
    const stmt = db.prepare(`
        SELECT 
            sceneId,
            serial,
            sequence,
            associatedCommentId,
            position,
            rotation,
            name,
            createdAt
        FROM scenes 
        WHERE serial = ? 
        ORDER BY sequence
    `);
    return stmt.all(serial).map(scene => ({
        ...scene,
        position: JSON.parse(scene.position),
        rotation: JSON.parse(scene.rotation)
    }));
}

function getSceneByCommentId(commentId) {
    const stmt = db.prepare(`
        SELECT 
            sceneId,
            serial,
            sequence,
            associatedCommentId,
            position,
            rotation,
            name,
            createdAt
        FROM scenes 
        WHERE associatedCommentId = ?
    `);
    const scene = stmt.get(commentId);
    if (scene) {
        scene.position = JSON.parse(scene.position);
        scene.rotation = JSON.parse(scene.rotation);
    }
    return scene;
}

function deleteScene(sceneId) {
    const stmt = db.prepare('DELETE FROM scenes WHERE sceneId = ?');
    return stmt.run(sceneId);
}

function updateScene(sceneId, updates) {
    // Example of 'updates' object:
    // const updates = {
    //     sequence: 2,                              // New sequence number
    //     position: [10.5, 0, -3.2],               // New position array
    //     rotation: [0, Math.PI/2, 0],             // New rotation array
    //     name: "Updated Scene Name"               // New scene name
    // };
    
    const validFields = ['sequence', 'position', 'rotation', 'name'];
    const updateEntries = Object.entries(updates)
        .filter(([key]) => validFields.includes(key))
        .map(([key, value]) => {
            if (key === 'position' || key === 'rotation') {
                value = JSON.stringify(value);
            }
            return `${key} = ?`;
        });
    
    if (updateEntries.length === 0) return null;

    const stmt = db.prepare(`
        UPDATE scenes 
        SET ${updateEntries.join(', ')} 
        WHERE sceneId = ?
    `);
    
    const values = [...Object.values(updates), sceneId];
    return stmt.run(...values);
}

// Update comment functions to handle scene associations
function getCommentsBySerial(serial, limit = 15) {
    const stmt = db.prepare(`
      SELECT * FROM comments 
      WHERE serial = ? 
      ORDER BY createdAt DESC 
      LIMIT ?
    `);
    return stmt.all(serial, limit);
}

function addComment(serial, userId, content, positionArray, attachScene = false, sceneId = null) {
    const stmt = db.prepare(`
        INSERT INTO comments (
            serial, userId, content, positionArray, 
            attachScene, associatedSceneId
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(serial, userId, content, positionArray, attachScene ? 1 : 0, sceneId);
}

function deleteComment(commentId, userId) {
    const stmt = db.prepare(`
      DELETE FROM comments 
      WHERE id = ? AND userId = ?
    `);
    return stmt.run(commentId, userId);
}

// Export updated functions
module.exports = {
    db,
    addScene,
    getSceneById,
    getScenesBySerial,
    getSceneByCommentId,
    deleteScene,
    updateScene,
    getCommentsBySerial,
    addComment,
    deleteComment
};

// to do: re-arrange the order of scenes by dragging. too complex to do it now.