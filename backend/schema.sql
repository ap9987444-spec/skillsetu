IF OBJECT_ID('dbo.progress','U') IS NULL
CREATE TABLE dbo.progress (
  user_id INT NOT NULL,
  study_unit_id INT NOT NULL,
  completed BIT NOT NULL CONSTRAINT DF_progress_completed DEFAULT 0,
  completed_at DATETIME2 NULL,
  CONSTRAINT PK_progress PRIMARY KEY (user_id, study_unit_id)
);

IF OBJECT_ID('dbo.users','U') IS NULL
CREATE TABLE dbo.users (
  id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
  name NVARCHAR(120) NOT NULL,
  email NVARCHAR(255) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  role NVARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT 'student',
  created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_users_role CHECK (role IN ('student','institute','employer','admin'))
);

IF OBJECT_ID('dbo.student_profiles','U') IS NULL
CREATE TABLE dbo.student_profiles (
  user_id INT NOT NULL CONSTRAINT PK_student_profiles PRIMARY KEY,
  branch NVARCHAR(120) NOT NULL CONSTRAINT DF_student_profiles_branch DEFAULT 'Computer Science',
  [year] INT NOT NULL CONSTRAINT DF_student_profiles_year DEFAULT 2,
  cgpa DECIMAL(4,2) NULL,
  career_direction NVARCHAR(160) NULL CONSTRAINT DF_student_profiles_career DEFAULT 'Software Engineering',
  preferred_location NVARCHAR(160) NULL CONSTRAINT DF_student_profiles_location DEFAULT N'India · Remote',
  open_to_opportunities BIT NOT NULL CONSTRAINT DF_student_profiles_open DEFAULT 1,
  CONSTRAINT FK_student_profiles_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);

IF OBJECT_ID('dbo.skills','U') IS NULL
CREATE TABLE dbo.skills (
  id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_skills PRIMARY KEY,
  name NVARCHAR(120) NOT NULL CONSTRAINT UQ_skills_name UNIQUE,
  category NVARCHAR(120) NULL,
  demand_level NVARCHAR(30) NULL CONSTRAINT DF_skills_demand DEFAULT 'medium'
);

IF OBJECT_ID('dbo.user_skills','U') IS NULL
CREATE TABLE dbo.user_skills (
  user_id INT NOT NULL,
  skill_id INT NOT NULL,
  level DECIMAL(5,2) NOT NULL CONSTRAINT DF_user_skills_level DEFAULT 0,
  evidence NVARCHAR(MAX) NULL,
  verified BIT NOT NULL CONSTRAINT DF_user_skills_verified DEFAULT 0,
  CONSTRAINT PK_user_skills PRIMARY KEY (user_id, skill_id),
  CONSTRAINT FK_user_skills_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
  CONSTRAINT FK_user_skills_skills FOREIGN KEY (skill_id) REFERENCES dbo.skills(id) ON DELETE CASCADE
);

IF OBJECT_ID('dbo.study_units','U') IS NULL
CREATE TABLE dbo.study_units (
  id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_study_units PRIMARY KEY,
  branch NVARCHAR(120) NOT NULL,
  [year] INT NOT NULL,
  title NVARCHAR(200) NOT NULL,
  description NVARCHAR(MAX) NULL,
  resource_url NVARCHAR(1000) NULL,
  resource_type NVARCHAR(40) NULL CONSTRAINT DF_study_units_type DEFAULT 'lesson'
);

IF OBJECT_ID('dbo.opportunities','U') IS NULL
CREATE TABLE dbo.opportunities (
  id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_opportunities PRIMARY KEY,
  title NVARCHAR(200) NOT NULL,
  employer NVARCHAR(200) NOT NULL,
  location NVARCHAR(160) NULL,
  type NVARCHAR(30) NOT NULL,
  stipend_or_package NVARCHAR(120) NULL,
  duration NVARCHAR(80) NULL,
  description NVARCHAR(MAX) NULL,
  skills NVARCHAR(1000) NULL,
  created_at DATETIME2 NOT NULL CONSTRAINT DF_opportunities_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_opportunities_type CHECK (type IN ('internship','placement'))
);

IF OBJECT_ID('dbo.applications','U') IS NULL
CREATE TABLE dbo.applications (
  id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_applications PRIMARY KEY,
  user_id INT NOT NULL,
  opportunity_id INT NOT NULL,
  status NVARCHAR(30) NOT NULL CONSTRAINT DF_applications_status DEFAULT 'applied',
  applied_at DATETIME2 NOT NULL CONSTRAINT DF_applications_applied DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL CONSTRAINT DF_applications_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_applications_user_opportunity UNIQUE (user_id, opportunity_id),
  CONSTRAINT CK_applications_status CHECK (status IN ('saved','applied','screening','interview','offer','rejected')),
  CONSTRAINT FK_applications_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
  CONSTRAINT FK_applications_opportunities FOREIGN KEY (opportunity_id) REFERENCES dbo.opportunities(id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_study_units_branch_year' AND object_id=OBJECT_ID('dbo.study_units'))
CREATE INDEX IX_study_units_branch_year ON dbo.study_units(branch, [year]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_opportunities_type' AND object_id=OBJECT_ID('dbo.opportunities'))
CREATE INDEX IX_opportunities_type ON dbo.opportunities(type);