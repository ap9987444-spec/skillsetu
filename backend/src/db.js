import pg from 'pg';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: String(process.env.DB_SSL || 'false').toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30000
});

export async function initDb() {
  const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
  return pool;
}

export async function query(text, params = {}) {
  const names = Object.keys(params);
  const values = names.map(name => params[name]);
  const sql = text.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    const index = names.indexOf(name);
    if (index === -1) throw new Error('Missing SQL parameter: ' + name);
    return '$' + (index + 1);
  });
  return pool.query(sql, values);
}

export function publicUser(user) {
  return user ? {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at
  } : null;
}