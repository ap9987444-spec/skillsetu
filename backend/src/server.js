import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query, sql, initDb, publicUser } from './db.js';
import { requireAuth, requireRole, signToken } from './auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const origins = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim()) : true;

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const ok = (res, data) => res.json({ data });

app.get('/api/health', async (_, res) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ status: 'ok', service: 'skillsetu-api', database: 'mssql' });
  } catch {
    res.status(503).json({ status: 'error', service: 'skillsetu-api', database: 'unavailable' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'student' } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!['student', 'institute', 'employer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await query('SELECT id FROM dbo.users WHERE LOWER(email)=@email', { email: normalizedEmail });
    if (exists.recordset.length) return res.status(409).json({ error: 'An account with this email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const created = await query(
      `INSERT INTO dbo.users(name,email,password_hash,role)
       OUTPUT INSERTED.*
       VALUES(@name,@email,@password_hash,@role)`,
      { name: name.trim(), email: normalizedEmail, password_hash: hash, role }
    );
    const u = created.recordset[0];

    if (role === 'student') {
      await query('INSERT INTO dbo.student_profiles(user_id) VALUES(@id)', { id: u.id });
    }

    res.status(201).json({ data: { user: publicUser(u), token: signToken(u) } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    const result = await query('SELECT TOP 1 * FROM dbo.users WHERE LOWER(email)=@email', { email });
    const u = result.recordset[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
    ok(res, { user: publicUser(u), token: signToken(u) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const result = await query('SELECT TOP 1 * FROM dbo.users WHERE id=@id', { id: Number(req.auth.sub) });
  const u = result.recordset[0];
  if (!u) return res.status(404).json({ error: 'User not found' });
  ok(res, { user: publicUser(u) });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const [total, done, applications, open] = await Promise.all([
    query("SELECT COUNT(*) AS c FROM dbo.study_units WHERE branch='Computer Science' AND [year]=2"),
    query('SELECT COUNT(*) AS c FROM dbo.progress WHERE user_id=@id AND completed=1', { id: Number(req.auth.sub) }),
    query('SELECT COUNT(*) AS c FROM dbo.applications WHERE user_id=@id', { id: Number(req.auth.sub) }),
    query('SELECT COUNT(*) AS c FROM dbo.opportunities')
  ]);
  const totalUnits = total.recordset[0].c;
  ok(res, {
    study_progress: totalUnits ? Math.round(done.recordset[0].c / totalUnits * 100) : 0,
    applications: applications.recordset[0].c,
    open_opportunities: open.recordset[0].c
  });
});

app.get('/api/study/units', requireAuth, async (req, res) => {
  const branch = String(req.query.branch || 'Computer Science');
  const year = Number(req.query.year || 2);
  const result = await query(
    'SELECT * FROM dbo.study_units WHERE branch=@branch AND [year]=@year ORDER BY id',
    { branch, year }
  );
  ok(res, { units: result.recordset });
});

app.patch('/api/study/units/:id/progress', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const done = Boolean(req.body?.completed);
  await query(
    `IF EXISTS (SELECT 1 FROM dbo.progress WHERE user_id=@user_id AND study_unit_id=@study_unit_id)
       UPDATE dbo.progress SET completed=@completed, completed_at=CASE WHEN @completed=1 THEN SYSUTCDATETIME() ELSE NULL END
       WHERE user_id=@user_id AND study_unit_id=@study_unit_id
     ELSE
       INSERT INTO dbo.progress(user_id,study_unit_id,completed,completed_at)
       VALUES(@user_id,@study_unit_id,@completed,CASE WHEN @completed=1 THEN SYSUTCDATETIME() ELSE NULL END)`,
    { user_id: Number(req.auth.sub), study_unit_id: id, completed: done ? 1 : 0 }
  );
  ok(res, { completed: done });
});

app.get('/api/skills', requireAuth, async (req, res) => {
  const result = await query(
    `SELECT s.id,s.name,s.category,s.demand_level,
            COALESCE(us.level,0) AS level,COALESCE(us.verified,0) AS verified
     FROM dbo.skills s
     LEFT JOIN dbo.user_skills us ON us.skill_id=s.id AND us.user_id=@id
     ORDER BY s.name`,
    { id: Number(req.auth.sub) }
  );
  ok(res, { skills: result.recordset });
});

app.get('/api/profile', requireAuth, async (req, res) => {
  const result = await query('SELECT TOP 1 * FROM dbo.student_profiles WHERE user_id=@id', { id: Number(req.auth.sub) });
  ok(res, { profile: result.recordset[0] || null });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  if (req.auth.role !== 'student') return res.status(403).json({ error: 'Student profile only' });
  const p = req.body || {};
  await query(
    `IF EXISTS (SELECT 1 FROM dbo.student_profiles WHERE user_id=@user_id)
       UPDATE dbo.student_profiles
       SET branch=@branch,[year]=@year,cgpa=@cgpa,career_direction=@career_direction,
           preferred_location=@preferred_location,open_to_opportunities=@open_to_opportunities
       WHERE user_id=@user_id
     ELSE
       INSERT INTO dbo.student_profiles(user_id,branch,[year],cgpa,career_direction,preferred_location,open_to_opportunities)
       VALUES(@user_id,@branch,@year,@cgpa,@career_direction,@preferred_location,@open_to_opportunities)`,
    {
      user_id: Number(req.auth.sub),
      branch: p.branch || 'Computer Science',
      year: Number(p.year || 2),
      cgpa: p.cgpa == null ? null : Number(p.cgpa),
      career_direction: p.career_direction || 'Software Engineering',
      preferred_location: p.preferred_location || 'India · Remote',
      open_to_opportunities: p.open_to_opportunities === false ? 0 : 1
    }
  );
  const result = await query('SELECT TOP 1 * FROM dbo.student_profiles WHERE user_id=@id', { id: Number(req.auth.sub) });
  ok(res, { profile: result.recordset[0] });
});

app.get('/api/opportunities', requireAuth, async (req, res) => {
  const type = req.query.type;
  let result;
  if (type && ['internship', 'placement'].includes(type)) {
    result = await query('SELECT * FROM dbo.opportunities WHERE type=@type ORDER BY id DESC', { type });
  } else {
    result = await query('SELECT * FROM dbo.opportunities ORDER BY id DESC');
  }
  ok(res, { opportunities: result.recordset });
});

app.post('/api/applications', requireAuth, async (req, res) => {
  const oid = Number(req.body?.opportunity_id);
  if (!oid) return res.status(400).json({ error: 'opportunity_id is required' });

  try {
    const opportunity = await query('SELECT id FROM dbo.opportunities WHERE id=@id', { id: oid });
    if (!opportunity.recordset.length) return res.status(400).json({ error: 'Opportunity does not exist' });

    const existing = await query(
      'SELECT id FROM dbo.applications WHERE user_id=@user_id AND opportunity_id=@opportunity_id',
      { user_id: Number(req.auth.sub), opportunity_id: oid }
    );
    if (existing.recordset.length) return res.status(409).json({ error: 'You already applied to this opportunity' });

    const created = await query(
      `INSERT INTO dbo.applications(user_id,opportunity_id,status)
       OUTPUT INSERTED.*
       VALUES(@user_id,@opportunity_id,'applied')`,
      { user_id: Number(req.auth.sub), opportunity_id: oid }
    );
    ok(res, { application: created.recordset[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not submit application' });
  }
});

app.get('/api/applications', requireAuth, async (req, res) => {
  const result = await query(
    `SELECT a.*,o.title,o.employer,o.location,o.type
     FROM dbo.applications a
     JOIN dbo.opportunities o ON o.id=a.opportunity_id
     WHERE a.user_id=@id ORDER BY a.updated_at DESC`,
    { id: Number(req.auth.sub) }
  );
  ok(res, { applications: result.recordset });
});

app.patch('/api/applications/:id/status', requireAuth, requireRole('employer', 'admin'), async (req, res) => {
  const allowed = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected'];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid status' });
  await query(
    'UPDATE dbo.applications SET status=@status,updated_at=SYSUTCDATETIME() WHERE id=@id',
    { status: req.body.status, id: Number(req.params.id) }
  );
  const result = await query('SELECT TOP 1 * FROM dbo.applications WHERE id=@id', { id: Number(req.params.id) });
  ok(res, { application: result.recordset[0] || null });
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