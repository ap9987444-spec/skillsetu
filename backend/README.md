# SkillSetu Backend
Node.js + Express + SQLite API for the SkillSetu front end.

Run locally:
1. Install Node.js 20+.
2. Copy .env.example to .env.
3. Set a long random JWT_SECRET.
4. Run: npm install, npm run seed, npm start.
5. Health check: GET http://localhost:4000/api/health.

Demo account: demo@skillsetu.local / SkillSetuDemo123!

API: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, GET /api/dashboard, GET /api/study/units, PATCH /api/study/units/:id/progress, GET /api/skills, GET/PUT /api/profile, GET /api/opportunities, POST/GET /api/applications, PATCH /api/applications/:id/status.

Passwords use bcrypt and authentication uses bearer JWTs. Never commit real secrets or production credentials.