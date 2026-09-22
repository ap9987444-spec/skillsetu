import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query, initDb } from './db.js';
import { requireAuth, requireRole, signToken } from './auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const origins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim())
  : true;

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const ok = (res, data) => res.json({ data });

app.get('/api/health', async (_, res) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ status: 'ok', service: 'skillsetu-api', database: 'postgresql' });
  } catch {
    res.status(503).json({ status: 'error', service: 'skillsetu-api', database: 'unavailable' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'student' } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!['student', 'institute', 'employer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await query('SELECT id FROM users WHERE LOWER(email)=@email LIMIT 1', { email: normalizedEmail });
    if (exists.rows.length) return res.status(409).json({ error: 'An account with this email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const created = await query(
      'INSERT INTO users(name,email,password_hash,role) VALUES(@name,@email,@password_hash,@role) RETURNING *',
      { name: String(name).trim(), email: normalizedEmail, password_hash: hash, role }
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

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
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

app.patch('/api/applications/:id/status', requireAuth, requireRole('employer', 'admin'), async (req, res) => {
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