const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

// Clean password if extra text was present
let password = process.env.DB_PASSWORD || process.env.PASSWORD || '';
password = password.replace(/git\s*status/gi, '').trim();

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: password,
  database: process.env.DB_NAME || 'we_review',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create a connection pool to we_review database
const pool = mysql.createPool(DB_CONFIG);

/**
 * Initializes the database and required tables:
 * - we_review database
 * - users table
 * - products table
 * - reviews table
 */
async function initDatabase() {
  // Connect without database first to ensure it exists
  const rootConn = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
  });

  try {
    console.log(`[DB] Creating database '${DB_CONFIG.database}' if not exists...`);
    await rootConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
  } finally {
    await rootConn.end();
  }

  // Now create the required tables in we_review
  const conn = await pool.getConnection();
  try {
    console.log('[DB] Ensuring required tables exist (users, products, reviews)...');

    // 1. users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reviewer_id VARCHAR(64) UNIQUE NOT NULL,
        username VARCHAR(100),
        name VARCHAR(150),
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reviewer_id (reviewer_id),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns exist on existing users table
    const [userCols] = await conn.query('SHOW COLUMNS FROM users');
    const userColNames = userCols.map((c) => c.Field);
    if (!userColNames.includes('password_hash')) {
      await conn.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) AFTER email');
      console.log('[DB] Added password_hash column to users table.');
    }
    if (!userColNames.includes('name')) {
      await conn.query('ALTER TABLE users ADD COLUMN name VARCHAR(150) AFTER username');
      console.log('[DB] Added name column to users table.');
    }

    // 2. products table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asin VARCHAR(64) UNIQUE NOT NULL,
        title VARCHAR(500),
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_asin (asin)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. reviews table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reviewer_id VARCHAR(64) NOT NULL,
        asin VARCHAR(64) NOT NULL,
        review_title VARCHAR(500),
        review_text TEXT NOT NULL,
        review_rating DECIMAL(3, 2),
        review_date DATETIME,
        fake_probability DECIMAL(5, 4),
        prediction VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reviewer (reviewer_id),
        INDEX idx_product (asin)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('[DB] Database and tables successfully verified.');
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  initDatabase,
  DB_CONFIG,
};
