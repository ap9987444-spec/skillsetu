CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student','institute','employer','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  branch VARCHAR(120) NOT NULL DEFAULT 'Computer Science',
  year INTEGER NOT NULL DEFAULT 2,
  cgpa NUMERIC(4,2),
  career_direction VARCHAR(160) DEFAULT 'Software Engineering',
  preferred_location VARCHAR(160) DEFAULT 'India · Remote',
  open_to_opportunities BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  category VARCHAR(120),
  demand_level VARCHAR(30) DEFAULT 'medium'
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level NUMERIC(5,2) NOT NULL DEFAULT 0,
  evidence TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS study_units (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch VARCHAR(120) NOT NULL,
  year INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  resource_url VARCHAR(1000),
  resource_type VARCHAR(40) DEFAULT 'lesson'
);

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  employer VARCHAR(200) NOT NULL,
  branch VARCHAR(120),
  location VARCHAR(160),
  type VARCHAR(30) NOT NULL CHECK (type IN ('internship','placement')),
  stipend_or_package VARCHAR(120),
  duration VARCHAR(80),
  description TEXT,
  skills VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
 );

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS branch VARCHAR(120);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'applied' CHECK (status IN ('saved','applied','screening','interview','offer','rejected')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_unit_id INTEGER NOT NULL REFERENCES study_units(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, study_unit_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'application',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_study_units_branch_year ON study_units(branch, year);
CREATE INDEX IF NOT EXISTS ix_opportunities_type ON opportunities(type);
CREATE INDEX IF NOT EXISTS ix_opportunities_branch ON opportunities(branch);
CREATE INDEX IF NOT EXISTS ix_notifications_user_created ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_data BYTEA NOT NULL,
  extracted_text TEXT,
  extracted_skills VARCHAR(3000),
  resume_score INTEGER DEFAULT 0 CHECK (resume_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_resumes_user_updated ON resumes(user_id, updated_at DESC);
