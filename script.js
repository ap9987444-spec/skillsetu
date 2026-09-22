const views = [...document.querySelectorAll(".view")];
const nav = [...document.querySelectorAll(".nav-item")];
const toast = document.getElementById("toast");
const API_BASE = "https://skillsetu-api-production.up.railway.app/api";

let authToken = localStorage.getItem("skillsetu_token") || "";
let currentUser = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__skillsetuToast);
  window.__skillsetuToast = setTimeout(() => toast.classList.remove("show"), 2200);
}

function showView(id) {
  views.forEach(view => view.classList.toggle("hidden", view.id !== id));
  nav.forEach(item => item.classList.toggle("active", item.dataset.view === id));
  if (id === "applications") loadApplications();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

nav.forEach(item => item.addEventListener("click", () => showView(item.dataset.view)));
document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.go));
});

document.getElementById("themeToggle")?.addEventListener("click", event => {
  document.body.classList.toggle("dark");
  event.currentTarget.textContent = document.body.classList.contains("dark") ? "☀" : "☾";
});

document.querySelectorAll(".year-tab").forEach((tab, index) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".year-tab").forEach(item => item.classList.remove("active"));
    tab.classList.add("active");
    showToast(index < 2
      ? "This year is available in your current study plan."
      : "Year " + (index + 1) + " unlocks as you complete your current path.");
  });
});

document.getElementById("careerSelect")?.addEventListener("change", event => {
  showToast("Study path changed to " + event.target.value + ".");
});

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = "Bearer " + authToken;

  const response = await fetch(API_BASE + path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body.data ?? body;
}

const opportunities = [
  { logo: "NC", tone: "", type: "Internship", title: "Frontend Engineer Intern", company: "Nimbus Cloud Labs", place: "Pune", pay: "₹20,000 / mo", duration: "3 months", match: 89, skills: ["React", "JavaScript", "SQL"], reason: "Strong fit for your web-development path.", branch: "CSE / IT" },
  { logo: "PH", tone: "purple", type: "Internship", title: "LLM Applications Intern", company: "Prayag Health AI", place: "Hyderabad", pay: "₹44,000 / mo", duration: "6 months", match: 82, skills: ["Python", "AI / ML", "APIs"], reason: "Matches your Python foundation and AI direction.", branch: "AI / Data" },
  { logo: "AS", tone: "orange", type: "Placement", title: "Software Engineer — Platform", company: "Aeris Systems", place: "Bengaluru", pay: "₹24.8 LPA", duration: "Full-time", match: 76, skills: ["DSA", "Git", "APIs"], reason: "Builds directly on your DSA and backend readiness.", branch: "CSE / IT" },
  { logo: "SA", tone: "", type: "Internship", title: "Data Analyst Intern", company: "Sangam Analytics", place: "Noida", pay: "₹18,000 / mo", duration: "4 months", match: 78, skills: ["SQL", "Python", "Power BI"], reason: "Your SQL level is a strong starting point for analytics.", branch: "AI / Data" },
  { logo: "ID", tone: "purple", type: "Internship", title: "Cloud Support Intern", company: "Indus Digital", place: "Remote", pay: "₹22,000 / mo", duration: "3 months", match: 71, skills: ["Cloud", "Git", "APIs"], reason: "A practical route to close your current cloud gap.", branch: "CSE / IT" },
  { logo: "ME", tone: "orange", type: "Internship", title: "Mechanical Design Intern", company: "Mitra Engineering", place: "Pune", pay: "₹16,000 / mo", duration: "3 months", match: 68, skills: ["AutoCAD", "CAD", "Manufacturing"], reason: "A branch-specific pathway for mechanical engineering learners.", branch: "Mechanical" },
  { logo: "EL", tone: "", type: "Internship", title: "Embedded Systems Intern", company: "Electra Labs", place: "Bengaluru", pay: "₹21,000 / mo", duration: "4 months", match: 72, skills: ["C", "Microcontrollers", "Embedded"], reason: "Combines programming fundamentals with electronics practice.", branch: "Electronics" },
  { logo: "PW", tone: "purple", type: "Placement", title: "Electrical Systems Trainee", company: "PowerGrid Works", place: "Lucknow", pay: "₹5.8 LPA", duration: "Full-time", match: 69, skills: ["MATLAB", "Power Systems", "Electrical"], reason: "A structured entry route for electrical engineering skills.", branch: "Electrical" },
  { logo: "CB", tone: "orange", type: "Internship", title: "Civil Project Intern", company: "CivicBuild India", place: "Lucknow", pay: "₹15,000 / mo", duration: "3 months", match: 66, skills: ["AutoCAD", "Surveying", "Estimation"], reason: "Adds industry exposure to core civil-engineering skills.", branch: "Civil" },
  { logo: "AI", tone: "", type: "Internship", title: "Machine Learning Intern", company: "Astra Intelligence", place: "Remote", pay: "₹30,000 / mo", duration: "5 months", match: 74, skills: ["Python", "AI / ML", "SQL"], reason: "A next-step role after strengthening your ML fundamentals.", branch: "AI / Data" },
  { logo: "NX", tone: "purple", type: "Internship", title: "QA Automation Intern", company: "NextWave Tech", place: "Hyderabad", pay: "₹19,000 / mo", duration: "3 months", match: 75, skills: ["JavaScript", "Testing", "Git"], reason: "Uses your JavaScript base while adding test automation.", branch: "CSE / IT" },
  { logo: "EC", tone: "orange", type: "Internship", title: "IoT Solutions Intern", company: "EdgeCircuit", place: "Ahmedabad", pay: "₹20,000 / mo", duration: "4 months", match: 70, skills: ["C", "IoT", "Sensors"], reason: "Introduces applied embedded and IoT project experience.", branch: "Electronics" }
];

const availableSkills = ["JavaScript", "SQL", "React", "Python", "DSA", "Git", "Cloud", "AI / ML", "APIs", "Power BI", "Testing", "C", "MATLAB", "AutoCAD"];
const currentSkills = new Set(["JavaScript", "SQL", "React", "Python", "DSA", "Git"]);
const skillAliases = {
  DSA: ["DSA", "Data Structures", "Algorithms"],
  "AI / ML": ["AI / ML", "AI", "Machine Learning", "ML"],
  C: ["C", "Embedded"]
};

function skillMatches(skill) {
  if (currentSkills.has(skill)) return true;
  return (skillAliases[skill] || [skill]).some(alias => currentSkills.has(alias));
}

function calculateMatch(job) {
  const matched = job.skills.filter(skillMatches).length;
  const base = job.skills.length ? Math.round((matched / job.skills.length) * 100) : 0;
  return Math.max(55, Math.min(97, Math.round(base * 0.7 + job.match * 0.3)));
}

function renderSkillMatcher() {
  const host = document.getElementById("skills");
  if (!host || document.getElementById("skillMatcher")) return;

  const panel = document.createElement("section");
  panel.className = "panel skill-matcher";
  panel.id = "skillMatcher";
  panel.innerHTML = `
    <div class="panel-head">
      <div><h2>Smart skill matching</h2><p>Select your current skills to see matching opportunities and the next skill gap.</p></div>
      <span class="status-pill">Live</span>
    </div>
    <div class="matcher-body">
      <div class="matcher-grid">
        <div><span class="matcher-label">YOUR CURRENT SKILLS</span><div class="skill-picker" id="skillPicker"></div></div>
        <div class="matcher-result" id="matcherResult"></div>
      </div>
      <div class="recommendation-note"><strong>How it works:</strong> SkillSetu compares your selected skills with role requirements and calculates a readiness match.</div>
    </div>`;

  host.insertBefore(panel, host.querySelector(".two-col"));
  const picker = panel.querySelector("#skillPicker");

  availableSkills.forEach(skill => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skill-choice" + (currentSkills.has(skill) ? " selected" : "");
    button.textContent = skill;
    button.addEventListener("click", () => {
      currentSkills.has(skill) ? currentSkills.delete(skill) : currentSkills.add(skill);
      button.classList.toggle("selected", currentSkills.has(skill));
      updateMatcher();
      renderOpportunities();
    });
    picker.appendChild(button);
  });

  updateMatcher();
}

function updateMatcher() {
  const result = document.getElementById("matcherResult");
  if (!result) return;

  const ranked = opportunities.map(job => ({ ...job, score: calculateMatch(job) })).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const matched = top.skills.filter(skillMatches);
  const missing = top.skills.filter(skill => !skillMatches(skill));

  result.innerHTML = `
    <div class="matcher-score"><div><span>BEST CURRENT MATCH</span><strong>${top.score}%</strong></div><span>${top.title}</span></div>
    <div class="match-next"><strong>Matched skills:</strong> ${matched.length ? matched.join(" · ") : "Add a skill to begin"}</div>
    <div class="gap-chips">${(missing.length ? missing : ["No immediate gap"]).map(skill => `<span class="gap-chip">${missing.length ? "Missing: " : ""}${skill}</span>`).join("")}</div>
    <div class="match-next"><strong>Next step:</strong> Learn ${missing[0] || "advanced skills"} to unlock more relevant roles.</div>`;
}

function renderOpportunities() {
  const host = document.querySelector("#opportunities .opportunity-cards");
  if (!host) return;

  host.innerHTML = opportunities.map(job => {
    const score = calculateMatch(job);
    const points = job.skills.filter(skillMatches).slice(0, 3);
    const gaps = job.skills.filter(skill => !skillMatches(skill)).slice(0, 2);

    return `
      <article class="job-card" data-branch="${job.branch}" data-score="${score}">
        <div class="job-top"><span class="company-logo ${job.tone}">${job.logo}</span><span class="tag">${job.type}</span></div>
        <h3>${job.title}</h3>
        <p>${job.company} · ${job.place}</p>
        <div class="job-meta"><span>${job.pay}</span><span>${job.duration}</span><strong>${score}% match</strong></div>
        <div class="skill-tags">${job.skills.map(skill => `<span>${skill}</span>`).join("")}</div>
        <div class="why-match"><strong>Why recommended?</strong><p>${job.reason}</p><div class="match-points">
          ${points.map(skill => `<span>✓ ${skill}</span>`).join("")}
          ${gaps.slice(0, 1).map(skill => `<span style="background:var(--orange-soft);color:var(--orange)">Gap: ${skill}</span>`).join("")}
        </div></div>
        <button class="primary-btn apply-btn" type="button">View & apply</button>
      </article>`;
  }).join("");

  host.querySelectorAll(".apply-btn").forEach(button => {
    button.addEventListener("click", () => applyOpportunity(button.closest(".job-card"), button));
  });
}

function setupOpportunityFilters() {
  const bar = document.querySelector("#opportunities .filter-bar");
  const filterButton = document.getElementById("filterBtn");
  if (!bar || !filterButton) return;

  let highOnly = false;

  const applyFilters = activeLabel => {
    document.querySelectorAll("#opportunities .job-card").forEach(card => {
      const branch = card.dataset.branch || "";
      const score = Number(card.dataset.score || 0);
      const type = card.querySelector(".tag")?.textContent?.trim() || "";
      let visible = true;

      if (activeLabel === "Internships") visible = type === "Internship";
      else if (activeLabel === "Placements") visible = type === "Placement";
      else if (activeLabel === "Remote") visible = card.textContent.includes("Remote");
      else if (activeLabel === "AI / Data") visible = branch === "AI / Data";
      else if (activeLabel === "Software") visible = branch === "CSE / IT";

      if (highOnly && score < 75) visible = false;
      card.style.display = visible ? "" : "none";
    });
  };

  bar.querySelectorAll(".filter").forEach(filter => {
    filter.addEventListener("click", () => {
      bar.querySelectorAll(".filter").forEach(item => item.classList.remove("active"));
      filter.classList.add("active");
      applyFilters(filter.textContent.trim());
    });
  });

  filterButton.addEventListener("click", () => {
    highOnly = !highOnly;
    applyFilters(bar.querySelector(".filter.active")?.textContent?.trim() || "All");
    filterButton.textContent = highOnly ? "Showing 75%+ matches" : "Show high-match only";
    showToast(highOnly ? "Showing roles with 75%+ readiness match." : "Showing all opportunities.");
  });
}

async function applyOpportunity(card, button) {
  if (!authToken || !currentUser) {
    window.skillsetuAuth?.openAuth("login");
    showToast("Please log in before applying.");
    return;
  }

  const title = card?.querySelector("h3")?.textContent?.trim();
  if (!title) return;

  button.disabled = true;
  button.textContent = "Applying…";

  try {
    const data = await api("/opportunities");
    const job = data.opportunities?.find(item => item.title === title);
    if (!job) throw new Error("This opportunity is not available in the database yet.");

    const result = await api("/applications", {
      method: "POST",
      body: JSON.stringify({ opportunity_id: job.id })
    });

    button.textContent = "Applied ✓";
    showToast(result.emailSent ? "Applied! Confirmation email sent." : "Application saved to your account.");
    await loadApplications();
  } catch (error) {
    button.disabled = false;
    button.textContent = "View & apply";
    showToast(error.message);
  }
}

async function loadApplications() {
  const panel = document.getElementById("applicationsPanel");
  if (!panel) return;

  if (!authToken || !currentUser) {
    panel.innerHTML = `<div class="panel-head"><div><h2>Recent applications</h2><p>Log in to load your live application status.</p></div></div><div class="empty-state">Student applications appear here after login.</div>`;
    return;
  }

  try {
    const data = await api("/applications");
    const applications = data.applications || [];
    const rows = applications.map(application => `
      <div class="application-row">
        <span><strong>${application.title}</strong><small>${application.employer} · Applied ${new Date(application.applied_at).toLocaleDateString()}</small></span>
        <span class="status orange">${application.status}</span>
        <button class="outline-btn" type="button">Details</button>
      </div>`).join("");

    panel.innerHTML = `<div class="panel-head"><div><h2>Recent applications</h2><p>Live status from your SkillSetu account.</p></div></div>
      ${rows || '<div class="empty-state">No applications yet. Explore opportunities and apply when you are ready.</div>'}`;
  } catch {
    showToast("Could not load your applications.");
  }
}

function updateAuthButton() {
  const button = document.getElementById("authButton");
  if (!button) return;

  const label = button.querySelector("span:last-of-type");
  const avatar = button.querySelector(".mini-avatar");

  if (authToken && currentUser) {
    const name = currentUser.name || "Student";
    label.textContent = name;
    if (avatar) avatar.textContent = name.slice(0, 2).toUpperCase();
  } else {
    label.textContent = "Student Login";
    if (avatar) avatar.textContent = "ST";
  }
}

(function setupAuth() {
  const authModal = document.getElementById("authModal");
  const authButton = document.getElementById("authButton");
  const authClose = document.getElementById("authClose");
  const authSwitch = document.getElementById("authSwitch");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const authTitle = document.getElementById("authTitle");
  const authSubtitle = document.getElementById("authSubtitle");

  if (!authModal || !authButton || !loginForm || !registerForm) return;

  const authStyle = document.createElement("style");
  authStyle.textContent = `
    .auth-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
    .auth-modal.hidden{display:none}
    .auth-backdrop{position:absolute;inset:0;background:rgba(9,14,24,.55);backdrop-filter:blur(3px)}
    .auth-card{position:relative;width:min(420px,100%);background:var(--white);border:1px solid var(--line);border-radius:16px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.22);z-index:1}
    .auth-close{position:absolute;right:14px;top:10px;border:0;background:transparent;font-size:25px;color:var(--muted);cursor:pointer}
    .auth-brand{font-weight:900;color:var(--blue);font-size:13px;letter-spacing:.5px}
    .auth-card h2{margin:7px 0 5px;font-size:24px}
    .auth-card p{margin:0 0 20px;color:var(--muted);font-size:12px;line-height:1.5}
    .auth-card form{display:grid;gap:13px}
    .auth-card label{display:grid;gap:6px;font-size:10px;font-weight:800;color:var(--ink)}
    .auth-card input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;padding:11px 12px;background:var(--white);color:var(--ink);outline:none}
    .auth-card input:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft)}
    .auth-submit{width:100%;margin-top:3px}
    .auth-switch{margin:16px auto 0;display:block;border:0;background:transparent;color:var(--blue);font-size:11px;font-weight:800;cursor:pointer}
    .auth-note{display:block;margin-top:14px;text-align:center;color:var(--muted);line-height:1.4}
    body.dark .auth-card{background:#111722;border-color:#2b3240}
  `;
  document.head.appendChild(authStyle);

  let registerMode = false;

  function setMode(register) {
    registerMode = register;
    loginForm.classList.toggle("hidden", register);
    registerForm.classList.toggle("hidden", !register);
    authTitle.textContent = register ? "Create Student Account" : "Student Login";
    authSubtitle.textContent = register
      ? "Create an account so your profile, applications and messages stay connected."
      : "Log in with your email to save your profile and applications.";
    authSwitch.textContent = register ? "Already have an account? Login" : "New student? Create an account";
  }

  function openAuth(mode = "login") {
    setMode(mode === "register");
    authModal.classList.remove("hidden");
  }

  function closeAuth() {
    authModal.classList.add("hidden");
  }

  authButton.addEventListener("click", () => {
    if (authToken && currentUser) {
      authToken = "";
      currentUser = null;
      localStorage.removeItem("skillsetu_token");
      updateAuthButton();
      loadApplications();
      showToast("You have been logged out.");
      return;
    }
    openAuth("login");
  });

  authClose?.addEventListener("click", closeAuth);
  authModal.querySelector("[data-close-auth]")?.addEventListener("click", closeAuth);
  authSwitch?.addEventListener("click", () => setMode(!registerMode));

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("loginEmail").value,
          password: document.getElementById("loginPassword").value
        })
      });
      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem("skillsetu_token", authToken);
      closeAuth();
      updateAuthButton();
      showToast("Welcome back, " + currentUser.name + "!");
      await loadApplications();
    } catch (error) {
      showToast(error.message);
    }
  });

  registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const result = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("registerName").value,
          email: document.getElementById("registerEmail").value,
          password: document.getElementById("registerPassword").value,
          role: "student"
        })
      });
      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem("skillsetu_token", authToken);
      closeAuth();
      updateAuthButton();
      showToast("Student account created successfully.");
      await loadApplications();
    } catch (error) {
      showToast(error.message);
    }
  });

  window.skillsetuAuth = { openAuth, closeAuth };
})();

async function restoreSession() {
  updateAuthButton();
  if (!authToken) {
    loadApplications();
    return;
  }

  try {
    const result = await api("/auth/me");
    currentUser = result.user;
    updateAuthButton();
    await loadApplications();
  } catch {
    authToken = "";
    currentUser = null;
    localStorage.removeItem("skillsetu_token");
    updateAuthButton();
    loadApplications();
  }
}

(function initialize() {
  showView("overview");
  renderSkillMatcher();
  renderOpportunities();
  setupOpportunityFilters();
  restoreSession();
})();
