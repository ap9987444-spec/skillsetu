# SkillSetu Backend

Node.js + Express + Microsoft SQL Server API for the SkillSetu front end.

## Local setup

1. Install Node.js 20+.
2. Create a Microsoft SQL Server database named `SkillSetu` (or change `DB_NAME`).
3. Copy `.env.example` to `.env`.
4. Set `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and a long random `JWT_SECRET`.
5. Run `npm install`.
6. Run `npm run seed`.
7. Run `npm start`.
8. Health check: `GET /api/health`.

The API automatically creates the required tables/indexes from `schema.sql` on startup.

## Demo account

Email: `demo@skillsetu.local`  
Password: `SkillSetuDemo123!`

## API

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/dashboard
- GET /api/study/units
- PATCH /api/study/units/:id/progress
- GET /api/skills
- GET/PUT /api/profile
- GET /api/opportunities
- POST/GET /api/applications
- PATCH /api/applications/:id/status

Passwords use bcrypt and authentication uses bearer JWTs. Never commit real secrets or production credentials.

## Production architecture

GitHub Pages serves the frontend. A Node/Express host serves this API, and Microsoft SQL Server/Azure SQL stores the data:

Browser -> GitHub Pages -> Node/Express API -> Microsoft SQL Server/Azure SQL

Set the production frontend origin in `CLIENT_ORIGIN`, and point the frontend `SKILLSETU_API_BASE`/API base URL to the deployed backend URL.
