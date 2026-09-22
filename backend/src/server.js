import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query, initDb, publicUser } from './db.js';
import { requireAuth, requireRole, signToken } from './auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const origins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim())
  : true;

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
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
  res.setHeader('Content-Type', resume.mime_type);
  res.setHeader('Content-Disposition', 'inline; filename="' + String(resume.file_name).replace(/["\\]/g, '') + '"');
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
    const skill = await query('SELECT id FROM skills WHERE LOWER(name)=LOWER(@name) LIMIT 1', { name });
    if (!skill.rows.length) continue;
    await query(
      'INSERT INTO user_skills(user_id,skill_id,level,verified,evidence) VALUES(@user_id,@skill_id,@level,TRUE,@evidence) ON CONFLICT (user_id,skill_id) DO UPDATE SET level=EXCLUDED.level,verified=TRUE,evidence=EXCLUDED.evidence',
      { user_id: userId, skill_id: skill.rows[0].id, level, evidence: 'Selected by student in SkillSetu' }
    );
  }
  const result = await query(
    'SELECT s.id,s.name,COALESCE(us.level,0) AS level,COALESCE(us.verified,FALSE) AS verified FROM skills s LEFT JOIN user_skills us ON us.skill_id=s.id AND us.user_id=@id ORDER BY s.name',
    { id: userId }
  );
  ok(res, { skills: result.rows });
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
