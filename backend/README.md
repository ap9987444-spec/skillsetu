# SkillSetu Backend

Node.js + Express API with PostgreSQL storage for the SkillSetu front end.

## Local setup

1. Install Node.js 20+.
2. Create a PostgreSQL database.
3. Copy `.env.example` to `.env`.
4. Set `DATABASE_URL` to your PostgreSQL connection string, choose `DB_SSL=true` if your provider requires TLS, and set a long random `JWT_SECRET`.
5. Set `CLIENT_ORIGIN` to the front-end origin. For local development, this can be `http://localhost:5500`.
6. Run `npm install`.
7. Run `npm run seed` to insert the demo study resources and opportunities.
8. Run `npm start`.
9. Check `GET /api/health`; it verifies that the API can reach PostgreSQL.

The API creates the required tables and indexes from `schema.sql` on startup. The application uses PostgreSQL (`pg`), not Microsoft SQL Server.

## Demo account

Email: `demo@skillsetu.local`  
Password: `SkillSetuDemo123!`

Use demo credentials only for local/demo environments. Do not reuse them for a production account.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/study/units`
- `PATCH /api/study/units/:id/progress`
- `GET /api/skills`
- `GET/PUT /api/profile`
- `GET /api/opportunities`
- `POST/GET /api/applications`
- `PATCH /api/applications/:id/status`

Passwords are hashed with bcrypt and authentication uses bearer JWTs. Never commit real secrets or production credentials.

## Production architecture

GitHub Pages (or another static host) serves the front end. A Node/Express host such as Railway serves the API, and PostgreSQL stores application data:

Browser -> Static front end -> Node/Express API -> PostgreSQL

Configure `CLIENT_ORIGIN` to match the deployed front-end origin. Configure `DATABASE_URL`, `DB_SSL`, and `JWT_SECRET` in the API host's environment variables. If Career Guide AI is enabled, also configure `GROQ_API_KEY` there; never put the provider key in browser JavaScript.
