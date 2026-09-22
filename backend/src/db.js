import sql from 'mssql';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || 'SkillSetu',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: String(process.env.DB_ENCRYPT || 'true').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE || 'false').toLowerCase() === 'true'
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

export const poolPromise = new sql.ConnectionPool(config).connect();

export async function initDb() {
  const pool = await poolPromise;
  const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const statement of statements) await pool.request().query(statement);
  return pool;
}

export async function query(text, params = {}) {
  const pool = await poolPromise;
  const request = pool.request();
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  return request.query(text);
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

export { sql };