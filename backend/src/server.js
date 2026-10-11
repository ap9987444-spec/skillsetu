import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { query, initDb, publicUser } from './db.js';
import { requireAuth, requireRole, signToken } from './auth.js';
import careerAiRouter from './career-ai.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.CLIENT_ORIGIN ||
  (isProduction ? 'https://skillsetu-wheat.vercel.app' : 'http://localhost:5500'))
  .split(',').map(origin => origin.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' }
});
const careerAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many Career Guide requests. Please try again later.' }
});

app.use('/api/career-ai', careerAiLimiter, careerAiRouter);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const ok = (res, data) => res.json({ data });

app.get('/api/health', async (_, res) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ status: 'ok', service: 'skillsetu-api', database: 'postgresql' });
  } catch {
    res.status(503).json({ status: 'error', service: 'skillsetu-api', database: 'unavailable' });
  }
});

app.post('/api/auth/register', registerLimiter, async (req, res) => {
  const { name, email, password, role = 'student' } = req.body || {};
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedName || normalizedName.length > 120 ||
      !normalizedEmail || normalizedEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      typeof password !== 'string') {
    return res.status(400).json({ error: 'Enter a valid name, email and password' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 bytes' });
  }
  if (!['student', 'institute', 'employer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const exists = await query('SELECT id FROM users WHERE LOWER(email)=@email LIMIT 1', { email: normalizedEmail });
    if (exists.rows.length) return res.status(409).json({ error: 'An account with this email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const created = await query(
      'INSERT INTO users(name,email,password_hash,role) VALUES(@name,@email,@password_hash,@role) RETURNING *',
      { name: normalizedName, email: normalizedEmail, password_hash: hash, role }
    );
    const u = created.rows[0];

    if (role === 'student') {
      await query('INSERT INTO student_profiles(user_id) VALUES(@id) ON CONFLICT (user_id) DO NOTHING', { id: u.id });
    }

    res.status(201).json({ data: { user: publicUser(u), token: signToken(u) } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(401).json({ error: 'Invalid email or password' });
    const result = await query('SELECT * FROM users WHERE LOWER(email)=@email LIMIT 1', { email });
    const u = result.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    ok(res, { user: publicUser(u), token: signToken(u) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM users WHERE id=@id LIMIT 1', { id: Number(req.auth.sub) });
  const u = result.rows[0];
  if (!u) return res.status(404).json({ error: 'User not found' });
  ok(res, { user: publicUser(u) });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const id = Number(req.auth.sub);
  const profileResult = await query('SELECT branch,year FROM student_profiles WHERE user_id=@id LIMIT 1', { id });
  const branch = profileResult.rows[0]?.branch || 'Computer Science';
  const year = Number(profileResult.rows[0]?.year || 1);
  const [total, done, applications, open] = await Promise.all([
    query('SELECT COUNT(*)::int AS c FROM study_units WHERE branch=@branch AND year=@year', { branch, year }),
    query('SELECT COUNT(*)::int AS c FROM progress WHERE user_id=@id AND completed=TRUE', { id }),
    query('SELECT COUNT(*)::int AS c FROM applications WHERE user_id=@id', { id }),
    query('SELECT COUNT(*)::int AS c FROM opportunities WHERE branch=@branch', { branch })
  ]);
  const totalUnits = total.rows[0].c;
  ok(res, {
    study_progress: totalUnits ? Math.round(done.rows[0].c / totalUnits * 100) : 0,
    applications: applications.rows[0].c,
    open_opportunities: open.rows[0].c
  });
});

app.get('/api/study/units', async (req, res) => {
  const branch = String(req.query.branch || 'Computer Science');
  const year = Number(req.query.year || 1);
  const result = await query(
    'SELECT * FROM study_units WHERE branch=@branch AND year=@year ORDER BY id',
    { branch, year }
  );
  ok(res, { units: result.rows });
});

app.patch('/api/study/units/:id/progress', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = Number(req.auth.sub);
  const done = Boolean(req.body?.completed);
  await query(
    'INSERT INTO progress(user_id,study_unit_id,completed,completed_at) VALUES(@user_id,@study_unit_id,@completed,CASE WHEN @completed=TRUE THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT (user_id,study_unit_id) DO UPDATE SET completed=EXCLUDED.completed, completed_at=EXCLUDED.completed_at',
    { user_id: userId, study_unit_id: id, completed: done }
  );
  ok(res, { completed: done });
});

app.get('/api/skills', requireAuth, async (req, res) => {
  const result = await query(
    'SELECT s.id,s.name,s.category,s.demand_level,COALESCE(us.level,0) AS level,COALESCE(us.verified,FALSE) AS verified FROM skills s LEFT JOIN user_skills us ON us.skill_id=s.id AND us.user_id=@id ORDER BY s.name',
    { id: Number(req.auth.sub) }
  );
  ok(res, { skills: result.rows });
});

app.get('/api/profile', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM student_profiles WHERE user_id=@id LIMIT 1', { id: Number(req.auth.sub) });
  ok(res, { profile: result.rows[0] || null });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  if (req.auth.role !== 'student') return res.status(403).json({ error: 'Student profile only' });
  const existing = await query('SELECT * FROM student_profiles WHERE user_id=@id LIMIT 1', { id: Number(req.auth.sub) });
  const current = existing.rows[0] || {};
  const p = req.body || {};
  await query(
    'INSERT INTO student_profiles(user_id,branch,year,cgpa,career_direction,preferred_location,open_to_opportunities) VALUES(@user_id,@branch,@year,@cgpa,@career_direction,@preferred_location,@open_to_opportunities) ON CONFLICT (user_id) DO UPDATE SET branch=EXCLUDED.branch,year=EXCLUDED.year,cgpa=EXCLUDED.cgpa,career_direction=EXCLUDED.career_direction,preferred_location=EXCLUDED.preferred_location,open_to_opportunities=EXCLUDED.open_to_opportunities',
    {
      user_id: Number(req.auth.sub),
      branch: p.branch || current.branch || 'Computer Science',
      year: Number(p.year || current.year || 1),
      cgpa: p.cgpa === undefined ? current.cgpa : (p.cgpa == null ? null : Number(p.cgpa)),
      career_direction: p.career_direction || current.career_direction || 'Software Engineering',
      preferred_location: p.preferred_location || current.preferred_location || 'India · Remote',
      open_to_opportunities: p.open_to_opportunities === undefined ? (current.open_to_opportunities ?? true) : p.open_to_opportunities !== false
    }
  );
  const result = await query('SELECT * FROM student_profiles WHERE user_id=@id LIMIT 1', { id: Number(req.auth.sub) });
  ok(res, { profile: result.rows[0] });
});


async function extractResumeText(file) {
  if (!file) throw new Error('Resume file is required');
  const name = String(file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    const parsed = await pdfParse(file.buffer);
    return String(parsed.text || '').trim();
  }
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return String(parsed.value || '').trim();
  }
  if (file.mimetype === 'text/plain' || name.endsWith('.txt')) {
    return file.buffer.toString('utf8').trim();
  }
  throw new Error('Supported resume formats: PDF, DOCX and TXT');
}

function scoreResume(text, skills) {
  const lower = String(text || '').toLowerCase();
  const sectionWords = ['education', 'experience', 'projects', 'skills', 'certification', 'summary'];
  const sections = sectionWords.filter(word => lower.includes(word)).length;
  const foundSkills = skills.filter(s => lower.includes(String(s.name).toLowerCase()));
  const skillPoints = Math.min(60, foundSkills.length * 7);
  const sectionPoints = sections * 5;
  const lengthPoints = lower.length >= 600 ? 10 : lower.length >= 250 ? 5 : 0;
  return { score: Math.min(100, skillPoints + sectionPoints + lengthPoints), foundSkills };
}

app.post('/api/resume', requireAuth, upload.single('resume'), async (req, res) => {
  try {
    if (req.auth.role !== 'student') return res.status(403).json({ error: 'Student resume only' });
    const text = await extractResumeText(req.file);
    if (!text) return res.status(400).json({ error: 'Could not extract readable text from the resume' });
    const skillsResult = await query('SELECT id,name FROM skills ORDER BY name');
    const { score, foundSkills } = scoreResume(text, skillsResult.rows);
    await query('DELETE FROM resumes WHERE user_id=@user_id', { user_id: Number(req.auth.sub) });
    const saved = await query(
      'INSERT INTO resumes(user_id,file_name,mime_type,file_data,extracted_text,extracted_skills,resume_score) VALUES(@user_id,@file_name,@mime_type,@file_data,@extracted_text,@extracted_skills,@resume_score) RETURNING id,file_name,mime_type,extracted_skills,resume_score,created_at,updated_at',
      {
        user_id: Number(req.auth.sub),
        file_name: String(req.file.originalname || 'resume'),
        mime_type: String(req.file.mimetype || 'application/octet-stream'),
        file_data: req.file.buffer,
        extracted_text: text,
        extracted_skills: foundSkills.map(s => s.name).join(', '),
        resume_score: score
      }
    );
    ok(res, {
      resume: saved.rows[0],
      extracted_skills: foundSkills.map(s => s.name),
      resume_score: score,
      text_preview: text.slice(0, 700)
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Resume upload failed' });
  }
});

app.get('/api/resume', requireAuth, async (req, res) => {
  const result = await query(
    'SELECT id,file_name,mime_type,extracted_skills,resume_score,created_at,updated_at FROM resumes WHERE user_id=@id ORDER BY updated_at DESC LIMIT 1',
    { id: Number(req.auth.sub) }
  );
  ok(res, { resume: result.rows[0] || null });
});

app.get('/api/resume/file', requireAuth, async (req, res) => {
  const result = await query(
    'SELECT file_name,mime_type,file_data FROM resumes WHERE user_id=@id ORDER BY updated_at DESC LIMIT 1',
    { id: Number(req.auth.sub) }
  );
  const resume = result.rows[0];
  if (!resume) return res.status(404).json({ error: 'Resume not found' });
  const extension = String(resume.file_name || '').toLowerCase().split('.').pop();
  const safeMimeType = extension === 'pdf'
    ? 'application/pdf'
    : extension === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'text/plain; charset=utf-8';
  res.setHeader('Content-Type', safeMimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'attachment; filename="' + String(resume.file_name).replace(/["\\]/g, '') + '"');
  res.send(resume.file_data);
});

app.delete('/api/resume', requireAuth, async (req, res) => {
  await query('DELETE FROM resumes WHERE user_id=@id', { id: Number(req.auth.sub) });
  ok(res, { deleted: true });
});

app.put('/api/skills', requireAuth, async (req, res) => {
  const items = Array.isArray(req.body?.skills) ? req.body.skills : [];
  const userId = Number(req.auth.sub);
  for (const item of items) {
    const name = String(item?.name || '').trim();
    const level = Math.max(0, Math.min(5, Number(item?.level || 0)));
    if (!name) continue;
    if (!name || name.length > 120) continue;
    const skill = await query(
      "INSERT INTO skills(name,category,demand_level) VALUES(@name,'Student-declared','medium') ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
      { name }
    );
    await query(
      "INSERT INTO user_skills(user_id,skill_id,level,verified,evidence) VALUES(@user_id,@skill_id,@level,FALSE,@evidence) ON CONFLICT (user_id,skill_id) DO UPDATE SET level=CASE WHEN user_skills.verified THEN GREATEST(user_skills.level,EXCLUDED.level) ELSE EXCLUDED.level END,verified=user_skills.verified,evidence=CASE WHEN user_skills.verified THEN user_skills.evidence ELSE EXCLUDED.evidence END",
      { user_id: userId, skill_id: skill.rows[0].id, level, evidence: 'Claimed by student — verification pending' }
    );
  }
  const branchNames = Array.isArray(req.body?.branch_skills)
    ? [...new Set(req.body.branch_skills.map(name => String(name || '').trim()).filter(name => name.length > 0 && name.length <= 120))]
    : [];
  const selectedNames = [...new Set(items.map(item => String(item?.name || '').trim()).filter(Boolean))];
  if (branchNames.length) {
    await query(
      'DELETE FROM user_skills WHERE user_id=@user_id AND skill_id IN (SELECT id FROM skills WHERE name = ANY(@branch_names::text[])) AND skill_id NOT IN (SELECT id FROM skills WHERE name = ANY(@selected_names::text[]))',
      { user_id: userId, branch_names: branchNames, selected_names: selectedNames }
    );
  }
  const result = await query(
    'SELECT s.id,s.name,COALESCE(us.level,0) AS level,COALESCE(us.verified,FALSE) AS verified FROM skills s LEFT JOIN user_skills us ON us.skill_id=s.id AND us.user_id=@id ORDER BY s.name',
    { id: userId }
  );
  ok(res, { skills: result.rows });
});

const verificationBank = {
  JavaScript: [
    { q: 'Which keyword declares a block-scoped variable that can be reassigned?', options: ['var', 'let', 'const', 'static'], answer: 1 },
    { q: 'What does Array.prototype.map() return?', options: ['The original array only', 'A new transformed array', 'A number', 'A boolean'], answer: 1 },
    { q: 'Which value represents an explicitly missing value in JavaScript?', options: ['undefined', 'NaN', 'false', '0'], answer: 0 }
  ],
  Python: [
    { q: 'Which Python type stores an ordered, mutable collection?', options: ['tuple', 'list', 'set', 'frozenset'], answer: 1 },
    { q: 'What does len([10, 20, 30]) return?', options: ['2', '3', '30', '0'], answer: 1 },
    { q: 'Which keyword defines a function?', options: ['func', 'function', 'def', 'lambda'], answer: 2 }
  ],
  SQL: [
    { q: 'Which clause filters rows before grouping?', options: ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], answer: 1 },
    { q: 'Which command retrieves data from a table?', options: ['SELECT', 'PUSH', 'FETCHROW', 'READTABLE'], answer: 0 },
    { q: 'Which JOIN keeps all rows from the left table?', options: ['INNER JOIN', 'RIGHT JOIN', 'LEFT JOIN', 'CROSS JOIN'], answer: 2 }
  ],
  React: [
    { q: 'Which hook is commonly used for local component state?', options: ['useRoute', 'useState', 'useClass', 'useValue'], answer: 1 },
    { q: 'React components should return what?', options: ['A database row', 'A UI representation', 'A CSS file', 'A SQL query'], answer: 1 },
    { q: 'Which prop helps React identify list items?', options: ['id', 'indexOnly', 'key', 'nameOnly'], answer: 2 }
  ],
  DSA: [
    { q: 'Which data structure follows LIFO order?', options: ['Queue', 'Stack', 'Tree', 'Graph'], answer: 1 },
    { q: 'What is the average time complexity of binary search on a sorted array?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1) always'], answer: 1 },
    { q: 'Which structure is commonly used for breadth-first search?', options: ['Stack', 'Queue', 'Heap only', 'Hash set only'], answer: 1 }
  ],
  Git: [
    { q: 'Which command creates a new commit from staged changes?', options: ['git push', 'git commit', 'git fetch', 'git status'], answer: 1 },
    { q: 'Which command shows the working tree status?', options: ['git status', 'git merge', 'git clone', 'git tag'], answer: 0 },
    { q: 'Which command downloads a repository to your computer?', options: ['git diff', 'git clone', 'git log', 'git stash'], answer: 1 }
  ],
  APIs: [
    { q: 'Which HTTP method is conventionally used to retrieve a resource?', options: ['GET', 'DELETE', 'PATCH', 'CONNECT'], answer: 0 },
    { q: 'What does JSON primarily represent?', options: ['A styling language', 'Structured data', 'A database server', 'A network cable'], answer: 1 },
    { q: 'Which status code usually means a successful HTTP request?', options: ['404', '500', '200', '301'], answer: 2 }
  ],
  Networks: [
    { q: 'What does DNS commonly translate?', options: ['Domain names to IP addresses', 'HTML to CSS', 'Passwords to hashes', 'Files to folders'], answer: 0 },
    { q: 'Which protocol is commonly used to load secure websites?', options: ['HTTPS', 'FTP only', 'SMTP', 'ARP only'], answer: 0 },
    { q: 'What does an IP address identify at the network layer?', options: ['A network interface address', 'A CSS class', 'A database column', 'A file extension'], answer: 0 }
  ],
  Linux: [
    { q: 'Which command lists files in a directory?', options: ['ls', 'cd', 'pwd', 'touch'], answer: 0 },
    { q: 'Which command prints the current directory path?', options: ['mkdir', 'pwd', 'rm', 'cat'], answer: 1 },
    { q: 'Which command changes file permissions on Unix-like systems?', options: ['chmod', 'grep', 'echo', 'whoami'], answer: 0 }
  ],
  Cybersecurity: [
    { q: 'What is the principle of least privilege?', options: ['Give every user admin rights', 'Grant only the access needed', 'Reuse one password everywhere', 'Disable all updates'], answer: 1 },
    { q: 'Which is the safest way to store user passwords?', options: ['Plain text', 'Reversible encoding', 'Salted, slow password hash', 'A public spreadsheet'], answer: 2 },
    { q: 'What is multi-factor authentication designed to add?', options: ['A second proof of identity', 'A faster CPU', 'More database rows', 'A public profile'], answer: 0 }
  ],
  C: [
    { q: 'Which function is the standard entry point in a hosted C program?', options: ['start()', 'main()', 'run()', 'init()'], answer: 1 },
    { q: 'Which operator obtains the address of a variable?', options: ['*', '&', '%', '->'], answer: 1 },
    { q: 'Which header declares printf()?', options: ['stdlib.h', 'string.h', 'stdio.h', 'math.h'], answer: 2 }
  ],
  "Digital Electronics": [
    { q: 'What is the output of an AND gate when one input is 0?', options: ['Always 1', '0', 'Undefined', 'Alternates'], answer: 1 },
    { q: 'How many bits are in a standard binary digit?', options: ['1', '2', '4', '8'], answer: 0 },
    { q: 'Which circuit stores one bit of state?', options: ['Adder', 'Multiplexer', 'Flip-flop', 'Decoder only'], answer: 2 }
  ],
  Microcontrollers: [
    { q: 'What is GPIO commonly used for?', options: ['General-purpose digital input/output', 'Graphics rendering only', 'Database indexing', 'Internet domain registration'], answer: 0 },
    { q: 'What does an interrupt allow a controller to do?', options: ['Respond to an event', 'Erase all firmware', 'Increase supply voltage automatically', 'Replace the clock source always'], answer: 0 },
    { q: 'Which peripheral converts an analogue signal into a digital value?', options: ['DAC', 'ADC', 'UART', 'GPIO'], answer: 1 }
  ],
  Embedded: [
    { q: 'Which bus is commonly used for short-distance chip communication with clock and data lines?', options: ['SPI', 'SMTP', 'HTTP', 'DNS'], answer: 0 },
    { q: 'What is firmware?', options: ['Software designed for a device', 'A mechanical bearing', 'A spreadsheet formula', 'A type of solder only'], answer: 0 },
    { q: 'Why are timing constraints important in real-time embedded systems?', options: ['Correctness can depend on meeting deadlines', 'They remove the need for testing', 'They guarantee unlimited memory', 'They replace sensors'], answer: 0 }
  ],
  IoT: [
    { q: 'What does IoT connect?', options: ['Physical devices that sense or exchange data', 'Only printed books', 'Only desktop monitors', 'Only offline spreadsheets'], answer: 0 },
    { q: 'Which component commonly measures a physical condition?', options: ['Sensor', 'Compiler', 'Router table only', 'Text editor'], answer: 0 },
    { q: 'What is MQTT commonly used for?', options: ['Lightweight messaging between devices/services', '3D mechanical drawing', 'C memory allocation', 'Civil surveying'], answer: 0 }
  ],
  CAD: [
    { q: 'What does CAD stand for?', options: ['Computer-Aided Design', 'Circuit Array Data', 'Computer Access Directory', 'Calculated Axis Division'], answer: 0 },
    { q: 'Why are dimensions used in an engineering drawing?', options: ['To specify measurable sizes', 'To change material strength', 'To power a motor', 'To encrypt a file'], answer: 0 },
    { q: 'What is a 3D assembly used to represent?', options: ['Multiple components fitted together', 'A single text paragraph', 'A database backup', 'A circuit voltage only'], answer: 0 }
  ],
  Thermodynamics: [
    { q: 'The first law of thermodynamics expresses conservation of what?', options: ['Mass only', 'Energy', 'Electric charge only', 'Angular momentum only'], answer: 1 },
    { q: 'Heat naturally flows from which region to which?', options: ['Colder to hotter without work', 'Hotter to colder', 'Lower pressure to higher in every case', 'There is no general direction'], answer: 1 },
    { q: 'What is a system boundary in thermodynamics?', options: ['A real or imaginary surface around the system', 'A type of turbine blade', 'A CAD shortcut', 'A unit of temperature'], answer: 0 }
  ],
  Manufacturing: [
    { q: 'What is CNC short for?', options: ['Computer Numerical Control', 'Central Network Circuit', 'Calculated Normal Curve', 'Continuous Numeric Copy'], answer: 0 },
    { q: 'What is a primary purpose of quality inspection?', options: ['Check conformance to specifications', 'Increase defects', 'Remove all documentation', 'Change a product name'], answer: 0 },
    { q: 'Which process removes material using a rotating cutting tool in many common setups?', options: ['Milling', 'Casting', 'Forging only', 'Sintering only'], answer: 0 }
  ],
  "Circuit Theory": [
    { q: 'Kirchhoff’s Current Law states that at a node, current is conserved. What is the algebraic sum of currents?', options: ['Always 1 A', 'Zero', 'Always the supply voltage', 'Infinite'], answer: 1 },
    { q: 'Ohm’s law relates voltage, current and what?', options: ['Resistance', 'Frequency only', 'Magnetic flux only', 'Capacitance only'], answer: 0 },
    { q: 'In a series circuit, which quantity is the same through ideal components?', options: ['Current', 'Voltage across every component', 'Resistance', 'Power'], answer: 0 }
  ],
  "Power Systems": [
    { q: 'What is a transformer primarily used to change in an AC system?', options: ['Voltage level', 'Frequency in all cases', 'Power factor to exactly one automatically', 'DC polarity'], answer: 0 },
    { q: 'What is the purpose of electrical transmission lines?', options: ['Transfer electrical power over distance', 'Store all energy indefinitely', 'Convert AC to text', 'Measure concrete strength'], answer: 0 },
    { q: 'What does a circuit breaker do during certain fault conditions?', options: ['Interrupt current', 'Generate unlimited power', 'Increase fault current', 'Replace grounding'], answer: 0 }
  ],
  "Power Electronics": [
    { q: 'What is a rectifier commonly used to convert?', options: ['AC to DC', 'DC to AC only', 'Heat to mass', 'Digital data to concrete'], answer: 0 },
    { q: 'Which device is widely used as a controlled semiconductor switch?', options: ['IGBT', 'Resistor only', 'Fuse only', 'Transformer core only'], answer: 0 },
    { q: 'What does an inverter commonly convert?', options: ['DC to AC', 'AC to DC only', 'Light to sound', 'Pressure to force'], answer: 0 }
  ],
  PLC: [
    { q: 'What does PLC stand for in industrial automation?', options: ['Programmable Logic Controller', 'Power Line Capacitor', 'Primary Load Converter', 'Process Language Compiler'], answer: 0 },
    { q: 'What is a PLC input commonly connected to?', options: ['A sensor or switch', 'Only a website URL', 'A drawing dimension', 'A database table'], answer: 0 },
    { q: 'Why is an interlock used in a control system?', options: ['To prevent unsafe or invalid operation', 'To increase every motor speed', 'To remove all alarms', 'To store a CAD file'], answer: 0 }
  ],
  "Control Systems": [
    { q: 'What is feedback in a control system?', options: ['Using output information to influence control', 'Disconnecting every sensor', 'A type of wire insulation only', 'A database query'], answer: 0 },
    { q: 'What is a setpoint?', options: ['Desired target value', 'Measured error only', 'A fuse rating', 'A network port'], answer: 0 },
    { q: 'What is a common purpose of a PID controller?', options: ['Regulate a process using proportional, integral and derivative terms', 'Store SQL tables', 'Draw building plans', 'Compile C headers'], answer: 0 }
  ],
  Surveying: [
    { q: 'What is levelling used to determine?', options: ['Elevation differences', 'Concrete chemical formula only', 'Electric current', 'Database latency'], answer: 0 },
    { q: 'What is a benchmark in surveying?', options: ['A point with a known elevation', 'A type of steel beam only', 'A network password', 'A CAD texture'], answer: 0 },
    { q: 'Which instrument is commonly used to measure horizontal and vertical angles?', options: ['Theodolite', 'Oscilloscope', 'Thermometer', 'Clamp meter'], answer: 0 }
  ],
  "Structural Analysis": [
    { q: 'What is the main purpose of structural analysis?', options: ['Estimate forces, reactions and deformations', 'Choose website colours', 'Measure network bandwidth', 'Program a microcontroller only'], answer: 0 },
    { q: 'For a simply supported beam with a central point load, the support reactions are equal when what is true?', options: ['The supports are symmetric and the load is centered', 'One support is removed', 'The load is outside the span', 'The beam has no supports'], answer: 0 },
    { q: 'What does a bending-moment diagram represent?', options: ['Variation of bending moment along a member', 'Concrete curing time only', 'Soil colour', 'Current in a circuit'], answer: 0 }
  ],
  RCC: [
    { q: 'Why is steel reinforcement commonly used with concrete?', options: ['To help resist tensile forces', 'To make concrete transparent', 'To eliminate curing', 'To replace all cement'], answer: 0 },
    { q: 'What does RCC stand for?', options: ['Reinforced Cement Concrete', 'Rotating Circuit Controller', 'Rapid Concrete Cooling', 'Reinforced Clay Composite'], answer: 0 },
    { q: 'Why is concrete curing important?', options: ['It supports hydration and strength development', 'It removes the need for mix design', 'It guarantees zero cracking', 'It instantly dries all water'], answer: 0 }
  ],
  Estimation: [
    { q: 'What is a bill of quantities used for?', options: ['List measured work items and quantities', 'Record source code only', 'Measure current and voltage', 'Store student passwords'], answer: 0 },
    { q: 'What is a rate analysis used to estimate?', options: ['Cost per unit of work', 'A building’s exact lifespan', 'Soil colour only', 'Network packet size'], answer: 0 },
    { q: 'Why are dimensions checked before quantity calculation?', options: ['To calculate quantities consistently', 'To avoid all site inspections', 'To change structural loads', 'To replace drawings'], answer: 0 }
  ],
  Statistics: [
    { q: 'Which measure is the arithmetic average?', options: ['Mean', 'Range', 'Mode only', 'Variance'], answer: 0 },
    { q: 'What does standard deviation describe?', options: ['Spread of values around the mean', 'The largest value only', 'The number of columns', 'A model’s file size'], answer: 0 },
    { q: 'What is a sample in statistics?', options: ['A subset of a population', 'Always the entire population', 'A chart title', 'A missing value marker only'], answer: 0 }
  ],
  Pandas: [
    { q: 'Which Pandas object is two-dimensional and labelled?', options: ['DataFrame', 'Series', 'Index only', 'Tuple'], answer: 0 },
    { q: 'Which operation is commonly used to inspect the first rows of a DataFrame?', options: ['head()', 'tailor()', 'firstrow()', 'showall()'], answer: 0 },
    { q: 'What does dropna() commonly do?', options: ['Remove missing-value rows or columns according to options', 'Sort every column alphabetically', 'Train a neural network', 'Create a database server'], answer: 0 }
  ],
  "Machine Learning": [
    { q: 'What is a training set used for?', options: ['Fit model parameters', 'Only display final charts', 'Replace all test data', 'Store user passwords'], answer: 0 },
    { q: 'Why keep a test set separate from training data?', options: ['Estimate performance on unseen examples', 'Increase training memorization', 'Guarantee perfect accuracy', 'Remove the need for evaluation'], answer: 0 },
    { q: 'What is overfitting?', options: ['Model learns training-specific patterns that generalize poorly', 'Model has no parameters', 'Dataset contains only numbers', 'A model runs without input'], answer: 0 }
  ],
  "Data Visualization": [
    { q: 'Which chart is usually suitable for comparing values across categories?', options: ['Bar chart', 'Only a network packet trace', 'Raw binary dump', 'Password table'], answer: 0 },
    { q: 'Why label chart axes?', options: ['Explain what the values represent', 'Increase data accuracy automatically', 'Remove outliers automatically', 'Change the underlying dataset'], answer: 0 },
    { q: 'What can a scatter plot help reveal?', options: ['Relationships between two numeric variables', 'Only a file directory', 'Password strength by default', 'A guaranteed causal effect'], answer: 0 }
  ],
  Cloud: [
    { q: 'What is cloud computing?', options: ['On-demand computing resources delivered over a network', 'Only a local spreadsheet', 'A type of transistor', 'A mechanical drawing format'], answer: 0 },
    { q: 'What is a common benefit of managed cloud services?', options: ['Less infrastructure administration for the customer', 'No need for security', 'Unlimited free usage always', 'No monitoring needed'], answer: 0 },
    { q: 'Why use environment variables for deployment configuration?', options: ['Separate configuration from source code', 'Make secrets public', 'Replace authentication', 'Automatically fix every bug'], answer: 0 }
  ]
};

app.get('/api/skill-verification/:skill', requireAuth, async (req, res) => {
  const requested = String(req.params.skill || '').trim();
  const key = Object.keys(verificationBank).find(name => name.toLowerCase() === requested.toLowerCase());
  if (!key) return res.status(404).json({ error: 'Verification quiz is not available for this skill yet' });
  const questions = verificationBank[key].map(({ q, options }) => ({ q, options }));
  ok(res, { skill: key, questions });
});

app.post('/api/skill-verification/:skill', requireAuth, async (req, res) => {
  const requested = String(req.params.skill || '').trim();
  const key = Object.keys(verificationBank).find(name => name.toLowerCase() === requested.toLowerCase());
  if (!key) return res.status(404).json({ error: 'Verification quiz is not available for this skill yet' });
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const questions = verificationBank[key];
  const correct = questions.reduce((n, item, i) => n + (Number(answers[i]) === item.answer ? 1 : 0), 0);
  const passed = correct >= 2;
  const userId = Number(req.auth.sub);
  const skill = await query(
    "INSERT INTO skills(name,category,demand_level) VALUES(@name,'Skill verification','high') ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
    { name: key }
  );

  if (passed) {
    await query(
      'INSERT INTO user_skills(user_id,skill_id,level,verified,evidence) VALUES(@user_id,@skill_id,@level,TRUE,@evidence) ON CONFLICT (user_id,skill_id) DO UPDATE SET level=GREATEST(user_skills.level,EXCLUDED.level),verified=TRUE,evidence=EXCLUDED.evidence',
      { user_id: userId, skill_id: skill.rows[0].id, level: Math.min(5, Math.max(2, correct + 1)), evidence: 'Passed SkillSetu verification quiz' }
    );
  }
  ok(res, { skill: key, correct, total: questions.length, passed });
});

app.get('/api/skill-gap', requireAuth, async (req, res) => {
  const opportunityId = Number(req.query.opportunity_id || 0);
  const userId = Number(req.auth.sub);
  let job;
  if (opportunityId) {
    const r = await query('SELECT * FROM opportunities WHERE id=@id LIMIT 1', { id: opportunityId });
    job = r.rows[0];
  }
  if (!job) {
    const profile = await query('SELECT branch FROM student_profiles WHERE user_id=@id LIMIT 1', { id: userId });
    const branch = profile.rows[0]?.branch || 'Computer Science';
    const r = await query('SELECT * FROM opportunities WHERE branch=@branch ORDER BY id DESC LIMIT 1', { branch });
    job = r.rows[0];
  }
  if (!job) return ok(res, { match: 0, matched: [], missing: [], opportunity: null });
  const skills = getSkillList(job.skills);
  const userSkills = await query(
    'SELECT s.name,us.level FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=@id',
    { id: userId }
  );
  const known = new Set(userSkills.rows.map(s => String(s.name).toLowerCase()));
  const matched = skills.filter(s => known.has(s.toLowerCase()));
  const missing = skills.filter(s => !known.has(s.toLowerCase()));
  ok(res, { match: skills.length ? Math.round(matched.length / skills.length * 100) : 0, matched, missing, opportunity: job });
});

function getSkillList(value) {
  return (Array.isArray(value) ? value : String(value || '').split(',')).map(s => String(s).trim()).filter(Boolean);
}

app.get('/api/opportunities', async (req, res) => {
  const branch = String(req.query.branch || '').trim();
  const type = req.query.type;
  const filters = [];
  const params = {};
  if (branch) { filters.push('branch=@branch'); params.branch = branch; }
  if (type && ['internship', 'placement'].includes(type)) { filters.push('type=@type'); params.type = type; }
  const where = filters.length ? ' WHERE ' + filters.join(' AND ') : '';
  const result = await query('SELECT * FROM opportunities' + where + ' ORDER BY id DESC', params);
  ok(res, { opportunities: result.rows });
});

app.post('/api/applications', requireAuth, async (req, res) => {
  const oid = Number(req.body?.opportunity_id);
  const userId = Number(req.auth.sub);
  if (!oid) return res.status(400).json({ error: 'opportunity_id is required' });

  try {
    const opportunity = await query('SELECT * FROM opportunities WHERE id=@id LIMIT 1', { id: oid });
    if (!opportunity.rows.length) return res.status(400).json({ error: 'Opportunity does not exist' });
    const job = opportunity.rows[0];

    const existing = await query(
      'SELECT id FROM applications WHERE user_id=@user_id AND opportunity_id=@opportunity_id',
      { user_id: userId, opportunity_id: oid }
    );
    if (existing.rows.length) return res.status(409).json({ error: 'You already applied to this opportunity' });

    const created = await query(
      "INSERT INTO applications(user_id,opportunity_id,status) VALUES(@user_id,@opportunity_id,'applied') RETURNING *",
      { user_id: userId, opportunity_id: oid }
    );
    const application = created.rows[0];

    const userResult = await query('SELECT name,email FROM users WHERE id=@id LIMIT 1', { id: userId });
    const student = userResult.rows[0];
    const message = 'Your application for "' + job.title + '" at ' + job.employer + ' has been submitted successfully. Current status: Applied.';

    await query(
      "INSERT INTO notifications(user_id,application_id,title,message,type) VALUES(@user_id,@application_id,@title,@message,'application')",
      { user_id: userId, application_id: application.id, title: 'Application submitted', message }
    );

    let emailSent = false;
    if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL && student?.email) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.FROM_EMAIL,
            to: [student.email],
            subject: 'SkillSetu application submitted — ' + job.title,
            html: '<p>Hello ' + (student.name || 'Student') + ',</p><p>' + message + '</p><p>Log in to SkillSetu to track your application status.</p>'
          })
        });
        emailSent = emailResponse.ok;
      } catch (emailError) {
        console.error('Application email failed:', emailError);
      }
    }

    ok(res, { application, notification: message, emailSent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not submit application' });
  }
});

app.get('/api/applications', requireAuth, async (req, res) => {
  const result = await query(
    'SELECT a.*,o.title,o.employer,o.location,o.type FROM applications a JOIN opportunities o ON o.id=a.opportunity_id WHERE a.user_id=@id ORDER BY a.updated_at DESC',
    { id: Number(req.auth.sub) }
  );
  ok(res, { applications: result.rows });
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  const result = await query(
    'SELECT * FROM notifications WHERE user_id=@id ORDER BY created_at DESC LIMIT 50',
    { id: Number(req.auth.sub) }
  );
  ok(res, { notifications: result.rows });
});

app.patch('/api/applications/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const allowed = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected'];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid status' });
  await query(
    'UPDATE applications SET status=@status,updated_at=CURRENT_TIMESTAMP WHERE id=@id',
    { status: req.body.status, id: Number(req.params.id) }
  );
  const result = await query('SELECT * FROM applications WHERE id=@id LIMIT 1', { id: Number(req.params.id) });
  ok(res, { application: result.rows[0] || null });
});

app.use((err, _, res, __) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

initDb()
  .then(() => app.listen(port, () => console.log('SkillSetu API running on port ' + port)))
  .catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
