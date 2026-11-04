const Database = require("better-sqlite3");
const path = require("path");

// Allow tests to use a separate database file.
const databasePath =
    process.env.DB_PATH || path.join(__dirname, "bananaquest.db");
const db = new Database(databasePath);

db.exec(`
    CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

console.log("SQLite database connected successfully.");

module.exports = db;
