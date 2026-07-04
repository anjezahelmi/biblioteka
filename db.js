require('dotenv').config();
const { Pool, Client } = require('pg');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.PGDATABASE || 'libraria';

const baseConfig = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};

const pool = new Pool({ ...baseConfig, database: DB_NAME });

async function ensureDatabase() {
  const client = new Client({ ...baseConfig, database: 'postgres' });
  await client.connect();
  const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`✔ Databaza "${DB_NAME}" u krijua.`);
  }
  await client.end();
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS logins (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip TEXT,
      user_agent TEXT,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'I panjohur',
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'Të përgjithshme',
      format TEXT NOT NULL,
      file_path TEXT NOT NULL,
      cover_path TEXT,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      views INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      progress REAL NOT NULL DEFAULT 0,
      location TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, book_id)
    );
  `);
}

async function seedAdmin() {
  const res = await pool.query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
  if (res.rowCount === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
      ['Administratori', 'admin', hash]
    );
    console.log('✔ Admini u krijua: admin / admin123');
  }
}

async function seedBooks(sampleBooks) {
  const res = await pool.query('SELECT COUNT(*)::int AS n FROM books');
  if (res.rows[0].n > 0) return;
  for (const b of sampleBooks) {
    await pool.query(
      `INSERT INTO books (title, author, description, category, format, file_path, cover_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [b.title, b.author, b.description, b.category, b.format, b.file_path, b.cover_path || null]
    );
  }
  console.log(`✔ U shtuan ${sampleBooks.length} libra shembull.`);
}

async function init(sampleBooks) {
  await ensureDatabase();
  await initSchema();
  await seedAdmin();
  await seedBooks(sampleBooks || []);
}

module.exports = { pool, init };
