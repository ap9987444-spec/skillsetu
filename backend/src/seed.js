import bcrypt from 'bcryptjs';
import { query, pool, initDb } from './db.js';

const skills = [
  ['JavaScript','Development','high'],['SQL','Data','high'],['React','Development','medium'],
  ['Python','Programming','high'],['Cloud','Infrastructure','high'],['DSA','Core','high'],
  ['AI / ML','AI','growing'],['APIs','Development','medium'],['Git','Tools','medium']
];

const units = [
  ['Computer Science',1,'Programming Foundations','Variables, control flow, functions and problem solving','https://developer.mozilla.org/en-US/docs/Learn','course'],
  ['Computer Science',2,'Data Structures & Algorithms','Arrays, linked lists, trees, graphs and complexity','https://visualgo.net/','practice'],
  ['Computer Science',2,'Database Systems','SQL, normalisation, joins, indexing and transactions','https://www.postgresql.org/docs/','docs'],
  ['Computer Science',2,'Web Development','HTML, CSS, JavaScript, APIs and responsive UI','https://developer.mozilla.org/en-US/docs/Web','course'],
  ['Computer Science',2,'Object-Oriented Programming','Classes, interfaces, patterns and clean code','https://refactoring.guru/design-patterns','docs'],
  ['Computer Science',2,'Operating Systems','Processes, memory, scheduling and file systems','https://pages.cs.wisc.edu/~remzi/OSTEP/','book'],
  ['Computer Science',3,'AI / Machine Learning','Models, evaluation, data pipelines and deployment','https://scikit-learn.org/stable/user_guide.html','docs'],
  ['Computer Science',3,'Cloud Fundamentals','Compute, storage, networking and deployment','https://aws.amazon.com/getting-started/','course'],
  ['Computer Science',4,'Placement & Interview Readiness','Projects, resume, DSA practice and interviews','https://www.interviewbit.com/','practice']
];

const opportunities = [
  ['Frontend Engineer Intern','Nimbus Cloud Labs','Pune','internship','₹20,000 / mo','3 months','Build responsive product interfaces','React,JavaScript,SQL'],
  ['LLM Applications Intern','Prayag Health AI','Hyderabad','internship','₹44,000 / mo','6 months','Build AI-powered application workflows','Python,AI / ML,APIs'],
  ['Software Engineer — Platform','Aeris Systems','Bengaluru','placement','₹24.8 LPA','Full-time','Develop platform services and tooling','DSA,Git,APIs'],
  ['Data Analyst Intern','Sangam Analytics','Noida','internship','₹18,000 / mo','4 months','Create data reports and dashboards','SQL,Python,Power BI'],
  ['Cloud Support Intern','Indus Digital','Remote','internship','₹22,000 / mo','3 months','Support cloud infrastructure and developer tooling','Cloud,Git,APIs'],
  ['Mechanical Design Intern','Mitra Engineering','Pune','internship','₹16,000 / mo','3 months','Support CAD and mechanical design work','AutoCAD,CAD,Manufacturing'],
  ['Embedded Systems Intern','Electra Labs','Bengaluru','internship','₹21,000 / mo','4 months','Build and test embedded prototypes','C,Microcontrollers,Embedded'],
  ['Electrical Systems Trainee','PowerGrid Works','Lucknow','placement','₹5.8 LPA','Full-time','Work on electrical systems and analysis','MATLAB,Power Systems,Electrical'],
  ['Civil Project Intern','CivicBuild India','Lucknow','internship','₹15,000 / mo','3 months','Support civil project planning and estimation','AutoCAD,Surveying,Estimation'],
  ['Machine Learning Intern','Astra Intelligence','Remote','internship','₹30,000 / mo','5 months','Build and evaluate machine-learning workflows','Python,AI / ML,SQL'],
  ['QA Automation Intern','NextWave Tech','Hyderabad','internship','₹19,000 / mo','3 months','Create automated software tests','JavaScript,Testing,Git'],
  ['IoT Solutions Intern','EdgeCircuit','Ahmedabad','internship','₹20,000 / mo','4 months','Build applied IoT solutions and sensor workflows','C,IoT,Sensors']
];

await initDb();

for (const [name, category, demand_level] of skills) {
  await query(
    'INSERT INTO skills(name,category,demand_level) VALUES(@name,@category,@demand_level) ON CONFLICT (name) DO NOTHING',
    { name, category, demand_level }
  );
}

for (const [branch, year, title, description, resource_url, resource_type] of units) {
  const exists = await query(
    'SELECT id FROM study_units WHERE branch=@branch AND year=@year AND title=@title LIMIT 1',
    { branch, year, title }
  );
  if (!exists.rows.length) {
    await query(
      'INSERT INTO study_units(branch,year,title,description,resource_url,resource_type) VALUES(@branch,@year,@title,@description,@resource_url,@resource_type)',
      { branch, year, title, description, resource_url, resource_type }
    );
  }
}

for (const [title, employer, location, type, stipend_or_package, duration, description, skillsText] of opportunities) {
  const exists = await query('SELECT id FROM opportunities WHERE title=@title AND employer=@employer LIMIT 1', { title, employer });
  if (!exists.rows.length) {
    await query(
      'INSERT INTO opportunities(title,employer,location,type,stipend_or_package,duration,description,skills) VALUES(@title,@employer,@location,@type,@stipend_or_package,@duration,@description,@skills)',
      { title, employer, location, type, stipend_or_package, duration, description, skills: skillsText }
    );
  }
}

console.log('SkillSetu PostgreSQL database seeded successfully.');
await pool.end();