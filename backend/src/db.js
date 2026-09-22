import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();
const file=process.env.DATABASE_FILE||'./data/skillsetu.db';
const absolute=path.resolve(file);
fs.mkdirSync(path.dirname(absolute),{recursive:true});
export const db=new Database(absolute);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
export function publicUser(user){return user?{id:user.id,name:user.name,email:user.email,role:user.role,created_at:user.created_at}:null;}