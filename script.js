const views = [...document.querySelectorAll(".view")];
const nav = [...document.querySelectorAll(".nav-item")];
const toast = document.getElementById("toast");
const API_BASE = "https://skillsetu-api-live-production.up.railway.app/api";

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

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = "Bearer " + authToken;

  const response = await fetch(API_BASE + path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body.data ?? body;
}

let opportunities = [];
let selectedBranch = localStorage.getItem("skillsetu_branch") || "Computer Science";
let selectedYear = Number(localStorage.getItem("skillsetu_year") || 1);

const branchSkills = {
  "Computer Science": ["JavaScript","SQL","React","Python","DSA","Git","APIs","Cloud"],
  "Information Technology": ["Python","SQL","Networks","Linux","Cloud","Git","APIs","Cybersecurity"],
  "Electronics & Communication": ["C","Digital Electronics","Microcontrollers","Embedded","Signals","Communication","PCB","IoT"],
  "Mechanical Engineering": ["CAD","AutoCAD","SolidWorks","Manufacturing","Thermodynamics","Materials","CNC","GD&T"],
  "Electrical Engineering": ["Circuit Theory","MATLAB","Power Systems","Electrical Machines","Power Electronics","PLC","Control Systems"],
  "Civil Engineering": ["AutoCAD","Surveying","Structural Analysis","RCC","Estimation","Project Management"],
  "AI & Data Science": ["Python","SQL","Statistics","Pandas","Machine Learning","Deep Learning","Data Visualization","Git"]
};

const currentSkills = new Set((() => {
  try {
    const saved = JSON.parse(localStorage.getItem("skillsetu_skills_" + selectedBranch) || "null");
    if (Array.isArray(saved)) return saved.filter(skill => (branchSkills[selectedBranch] || []).includes(skill));
  } catch {}
  return selectedBranch === "Computer Science" ? ["JavaScript","SQL","React","Python","DSA","Git"] : [];
})());

let verifiedSkills = new Set();
let skillLevels = new Map();
let skillDemand = new Map();

function persistLocalSkills() {
  localStorage.setItem("skillsetu_skills_" + selectedBranch, JSON.stringify([...currentSkills]));
}

function renderSkillAnalytics() {
  const rows = document.getElementById("skillMapRows");
  const demandHost = document.getElementById("demandReadinessChart");
  const strengthHost = document.getElementById("skillStrengthBars");
  const branchList = branchSkills[selectedBranch] || [];
  const chosen = branchList.filter(skill => currentSkills.has(skill));
  const displaySkills = [...chosen, ...branchList.filter(skill => !currentSkills.has(skill))].slice(0, 5);
  const levelFor = skill => Math.max(0, Math.min(5, Number(skillLevels.get(skill) ?? (currentSkills.has(skill) ? 3 : 0))));
  if (rows) {
    rows.innerHTML = displaySkills.map(skill => {
      const level = levelFor(skill);
      const status = verifiedSkills.has(skill) ? "Verified" : currentSkills.has(skill) ? "Self-declared" : "Not added";
      return '<div class="skill-map-row"><div class="skill-map-title"><strong>' + skill + '</strong><span class="skill-evidence ' + (verifiedSkills.has(skill) ? "verified" : "") + '">' + status + '</span></div><div class="skillbar"><i style="width:' + (level * 20) + '%"></i></div><small>' + level + '/5 readiness</small></div>';
    }).join("") || '<div class="empty-state">No skills are configured for this branch yet.</div>';
  }
  if (strengthHost) {
    strengthHost.innerHTML = displaySkills.map(skill => {
      const level = levelFor(skill);
      return '<div class="chart-item"><span>' + skill + '</span><div><i style="width:' + (level * 20) + '%"></i></div><b>' + level + '/5</b></div>';
    }).join("") || '<div class="empty-state">No skill data available.</div>';
  }
  if (demandHost) {
    const knownDemand = branchList.filter(skill => skillDemand.has(skill)).slice(0, 4);
    if (!knownDemand.length) {
      demandHost.innerHTML = '<div class="empty-state">Sign in to compare your saved readiness with skill demand metadata.</div>';
    } else {
      demandHost.innerHTML = knownDemand.map(skill => {
        const demand = String(skillDemand.get(skill) || "medium").toLowerCase();
        const demandScore = demand === "high" ? 92 : demand === "growing" ? 76 : 58;
        const readiness = levelFor(skill) * 20;
        return '<div class="demand-row"><div class="demand-row-label"><span>' + skill + '</span><em>' + demand + ' demand</em></div><div class="demand-dual"><div title="Demand: ' + demandScore + '%"><i style="width:' + demandScore + '%"></i></div><div title="Readiness: ' + readiness + '%"><i style="width:' + readiness + '%"></i></div></div></div>';
      }).join("") + '<div class="demand-legend"><span><i class="demand-key"></i>Employer demand</span><span><i class="readiness-key"></i>Your readiness</span></div>';
    }
  }
}

const verificationSkillsByBranch = {
  "Computer Science": ["JavaScript","Python","SQL","React","DSA","Git","APIs","Cloud"],
  "Information Technology": ["Python","SQL","Networks","Linux","Cloud","Git","APIs","Cybersecurity"],
  "Electronics & Communication": ["C","Digital Electronics","Microcontrollers","Embedded","IoT"],
  "Mechanical Engineering": ["CAD","Thermodynamics","Manufacturing"],
  "Electrical Engineering": ["Circuit Theory","Power Systems","Power Electronics","PLC","Control Systems"],
  "Civil Engineering": ["Surveying","Structural Analysis","RCC","Estimation"],
  "AI & Data Science": ["Python","SQL","Statistics","Pandas","Machine Learning","Data Visualization"]
};

function refreshVerificationSkills() {
  const select = document.getElementById("verificationSkill");
  if (!select) return;
  const previous = select.value;
  const skills = verificationSkillsByBranch[selectedBranch] || [];
  select.innerHTML = '<option value="">Choose a skill to verify</option>' +
    skills.map(skill => '<option value="' + skill + '">' + skill + '</option>').join("");
  if (skills.includes(previous)) select.value = previous;
}

function restoreLocalSkillsForBranch() {
  currentSkills.clear();
  verifiedSkills = new Set();
  skillLevels = new Map();
  skillDemand = new Map();
  try {
    const saved = JSON.parse(localStorage.getItem("skillsetu_skills_" + selectedBranch) || "null");
    if (Array.isArray(saved)) saved.filter(skill => (branchSkills[selectedBranch] || []).includes(skill)).forEach(skill => currentSkills.add(skill));
    else if (selectedBranch === "Computer Science") ["JavaScript","SQL","React","Python","DSA","Git"].forEach(skill => currentSkills.add(skill));
  } catch {}
  persistLocalSkills();
  renderSkillAnalytics();
}

const skillAliases = {
  DSA:["DSA","Data Structures","Algorithms"],
  "AI / ML":["AI / ML","AI","Machine Learning","ML"],
  "Machine Learning":["Machine Learning","AI / ML","ML"],
  C:["C","Embedded"],
  "Power Systems":["Power Systems","Electrical"]
};

const careerLabels = {
  "Computer Science": "Software Engineering",
  "Information Technology": "IT / Cloud / Systems",
  "Electronics & Communication": "Embedded / Electronics",
  "Mechanical Engineering": "Mechanical Design / Manufacturing",
  "Electrical Engineering": "Power / Control / Automation",
  "Civil Engineering": "Structures / Construction",
  "AI & Data Science": "AI / Data / ML"
};

function updateBranchUI() {
  const overview = document.getElementById("overviewBranchText");
  const profileBranch = document.getElementById("profileBranch");
  const profileYear = document.getElementById("profileYear");
  const profileCareer = document.getElementById("profileCareer");
  if (overview) overview.textContent = selectedBranch + " · Year " + selectedYear + " · Build your skills one step at a time.";
  if (profileBranch) profileBranch.textContent = selectedBranch;
  if (profileYear) profileYear.textContent = selectedYear;
  if (profileCareer) profileCareer.textContent = careerLabels[selectedBranch] || "Career pathway";
}

function getJobSkills(job) {
  return (Array.isArray(job.skills) ? job.skills : String(job.skills || "").split(","))
    .map(skill => skill.trim())
    .filter(Boolean);
}

function skillMatches(skill) {
  if (currentSkills.has(skill)) return true;
  return (skillAliases[skill] || [skill]).some(alias => currentSkills.has(alias));
}

function calculateMatch(job) {
  const skills = getJobSkills(job);
  if (!skills.length) return 0;
  const matched = skills.filter(skillMatches).length;
  return Math.round((matched / skills.length) * 100);
}

function renderSkillMatcher() {
  const panel = document.getElementById("skillMatcher");
  if (!panel) return;
  refreshSkillPicker();
  updateMatcher();
}
function refreshSkillPicker() {
  const picker = document.getElementById("skillPicker");
  if (!picker) return;
  picker.innerHTML = "";
  (branchSkills[selectedBranch] || branchSkills["Computer Science"]).forEach(skill => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skill-choice" + (currentSkills.has(skill) ? " selected" : "");
    button.setAttribute("aria-pressed", String(currentSkills.has(skill)));
    button.textContent = skill;
    button.addEventListener("click", () => {
      currentSkills.has(skill) ? currentSkills.delete(skill) : currentSkills.add(skill);
      persistLocalSkills();
      button.classList.toggle("selected", currentSkills.has(skill));
      button.setAttribute("aria-pressed", String(currentSkills.has(skill)));
      syncSelectedSkills();
      renderSkillAnalytics();
      updateMatcher();
      renderOpportunities();
      applyOpportunityFilters();
    });
    picker.appendChild(button);
  });
}

function updateMatcher() {
  const result = document.getElementById("matcherResult");
  if (!result) return;
  if (!opportunities.length) {
    result.innerHTML = "<div class=\"match-next\">No opportunities are available for this branch yet.</div>";
    return;
  }

  renderSkillAnalytics();
  const ranked = opportunities.map(job => {
    const skills = getJobSkills(job);
    const matched = skills.filter(skillMatches);
    const missing = skills.filter(skill => !skillMatches(skill));
    return { ...job, score: calculateMatch(job), skills, matched, missing };
  }).sort((a, b) => b.score - a.score || b.matched.length - a.matched.length);
  const top = ranked[0];
  const total = top.skills.length;
  const matched = top.matched;
  const missing = top.missing;
  const nextSkill = missing[0];
  const scoreLabel = currentSkills.size ? top.score + "%" : "Add skills";

  result.innerHTML = `
    <div class="matcher-score"><div><span>BEST MATCH · ${selectedBranch}</span><strong>${scoreLabel}</strong></div><span>${top.title}</span></div>
    <div class="match-progress" role="progressbar" aria-label="Opportunity skill match" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${currentSkills.size ? top.score : 0}"><i style="width:${currentSkills.size ? top.score : 0}%"></i></div>
    <div class="match-breakdown"><span><b>${matched.length}</b> of ${total} required skills matched</span><span>${missing.length} skill gap${missing.length === 1 ? "" : "s"}</span></div>
    <div class="match-next"><strong>Skills you selected:</strong> ${matched.length ? matched.join(" · ") : "Select the skills you can currently use."}</div>
    <div class="gap-chips">${(missing.length ? missing.slice(0, 4) : ["No immediate gaps"]).map(skill => `<span class="gap-chip ${missing.length ? "gap-chip-missing" : "gap-chip-ready"}">${missing.length ? "Learn: " : ""}${skill}</span>`).join("")}</div>
    <div class="match-next"><strong>Why recommended?</strong> This ${top.type === "placement" ? "placement" : "internship"} is ranked first because it has the strongest overlap with your selected skills.</div>
    <div class="match-next"><strong>Next step:</strong> ${nextSkill ? "Practise " + nextSkill + " and verify it with a knowledge check." : "Keep your skills current and strengthen them with a project."}</div>`;
}

function renderOpportunities() {
  const host = document.querySelector("#opportunities .opportunity-cards");
  if (!host) return;
  if (!opportunities.length) {
    host.innerHTML = `<div class="empty-state">No opportunities are available for ${selectedBranch} yet.</div>`;
    return;
  }

  host.innerHTML = opportunities.map(job => {
    const skills = getJobSkills(job);
    const score = calculateMatch(job);
    const points = skills.filter(skillMatches).slice(0, 3);
    const gaps = skills.filter(skill => !skillMatches(skill)).slice(0, 2);
    const initials = String(job.employer || "SK").split(/\s+/).map(word => word[0]).join("").slice(0,2).toUpperCase();

    return `
      <article class="job-card" data-id="${job.id}" data-branch="${job.branch}" data-score="${score}">
        <div class="job-top"><span class="company-logo">${initials}</span><span class="tag">${job.type === "placement" ? "Placement" : "Internship"}</span></div>
        <h3>${job.title}</h3>
        <p>${job.employer} · ${job.location || "India"}</p>
        <div class="job-meta"><span>${job.stipend_or_package || "Details inside"}</span><span>${job.duration || ""}</span><strong>${score}% match</strong></div>
        <div class="skill-tags">${skills.map(skill => `<span>${skill}</span>`).join("")}</div>
        <div class="why-match"><strong>Why recommended?</strong><p>${job.description || "Relevant to your selected branch."}</p><div class="match-points">
          ${points.map(skill => `<span>✓ ${skill}</span>`).join("")}
          ${gaps.slice(0,1).map(skill => `<span style="background:var(--orange-soft);color:var(--orange)">Gap: ${skill}</span>`).join("")}
        </div></div>
        <button class="primary-btn apply-btn" type="button">View & apply</button>
      </article>`;
  }).join("");

  host.querySelectorAll(".apply-btn").forEach(button => {
    button.addEventListener("click", () => applyOpportunity(button.closest(".job-card"), button));
  });
}

async function loadOpportunities() {
  try {
    const data = await api("/opportunities?branch=" + encodeURIComponent(selectedBranch));
    opportunities = data.opportunities || [];
    const note = document.getElementById("opportunityBranchNote");
    if (note) note.textContent = "Showing internships and placements for " + selectedBranch + ".";
    renderOpportunities();
    updateMatcher();
    applyOpportunityFilters();
  } catch {
    opportunities = [];
    renderOpportunities();
    showToast("Could not load opportunities for this branch.");
  }
}

let highOnly = false;
let activeOpportunityFilter = "All";

function applyOpportunityFilters() {
  document.querySelectorAll("#opportunities .job-card").forEach(card => {
    const score = Number(card.dataset.score || 0);
    const type = card.querySelector(".tag")?.textContent?.trim() || "";
    let visible = true;
    if (activeOpportunityFilter === "Internships") visible = type === "Internship";
    else if (activeOpportunityFilter === "Placements") visible = type === "Placement";
    else if (activeOpportunityFilter === "Remote") visible = card.textContent.includes("Remote");
    if (highOnly && score < 75) visible = false;
    card.style.display = visible ? "" : "none";
  });
}

function setupOpportunityFilters() {
  const bar = document.querySelector("#opportunities .filter-bar");
  const filterButton = document.getElementById("filterBtn");
  if (!bar || !filterButton) return;

  bar.querySelectorAll(".filter").forEach(filter => {
    filter.onclick = () => {
      bar.querySelectorAll(".filter").forEach(item => item.classList.remove("active"));
      filter.classList.add("active");
      activeOpportunityFilter = filter.textContent.trim();
      applyOpportunityFilters();
    };
  });

  filterButton.onclick = () => {
    highOnly = !highOnly;
    applyOpportunityFilters();
    filterButton.textContent = highOnly ? "Showing 75%+ matches" : "Show high-match only";
  };
}

async function applyOpportunity(card, button) {
  if (!authToken || !currentUser) {
    window.skillsetuAuth?.openAuth("login");
    showToast("Please log in before applying.");
    return;
  }

  const id = Number(card?.dataset.id);
  if (!id) return;
  button.disabled = true;
  button.textContent = "Applying…";

  try {
    const result = await api("/applications", {
      method: "POST",
      body: JSON.stringify({ opportunity_id: id })
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


async function syncSelectedSkills() {
  if (!authToken || !currentUser) return;
  try {
    await api("/skills", { method: "PUT", body: JSON.stringify({
      branch_skills: branchSkills[selectedBranch] || [],
      skills: [...currentSkills].map(name => ({ name, level: 3 }))
    })});
  } catch {
    showToast("Skills saved locally; account sync failed.");
  }
}

async function loadSavedSkills() {
  if (!authToken || !currentUser) return;
  try {
    const data = await api("/skills");
    const allowed = new Set(branchSkills[selectedBranch] || []);
    skillLevels = new Map((data.skills || []).map(skill => [skill.name, Number(skill.level) || 0]));
    skillDemand = new Map((data.skills || []).map(skill => [skill.name, skill.demand_level || "medium"]));
    verifiedSkills = new Set((data.skills || []).filter(skill => skill.verified).map(skill => skill.name));
    currentSkills.clear();
    (data.skills || []).filter(s => Number(s.level) > 0 && allowed.has(s.name)).forEach(s => currentSkills.add(s.name));
    persistLocalSkills();
    refreshSkillPicker();
    refreshVerificationSkills();
    renderSkillAnalytics();
    updateMatcher();
  } catch {}
}

function setupSkillVerification() {
  const skillSelect = document.getElementById("verificationSkill");
  const startBtn = document.getElementById("startVerificationBtn");
  const result = document.getElementById("verificationResult");
  if (!skillSelect || !startBtn || !result) return;
  refreshVerificationSkills();

  startBtn.addEventListener("click", async () => {
    if (!authToken || !currentUser) {
      window.skillsetuAuth?.openAuth("login");
      showToast("Please log in before verifying a skill.");
      return;
    }
    const skill = skillSelect.value;
    if (!skill) {
      showToast("Choose a skill first.");
      return;
    }
    startBtn.disabled = true;
    startBtn.textContent = "Loading…";
    try {
      const data = await api("/skill-verification/" + encodeURIComponent(skill));
      result.innerHTML = '<div class="verification-quiz"><div class="verification-quiz-head"><h3>Knowledge check: ' + data.skill + '</h3><p>' + data.questions.length + ' questions · Answer every question to receive your result.</p></div>' +
        data.questions.map((q, i) => '<fieldset><legend>' + (i + 1) + '. ' + q.q + '</legend>' +
          q.options.map((option, j) => '<label><input type="radio" name="verify-' + i + '" value="' + j + '"> ' + option + '</label>').join('') +
        '</fieldset>').join('') +
        '<button class="primary-btn" id="submitVerificationBtn" type="button">Submit answers</button></div>';

      document.getElementById("submitVerificationBtn").addEventListener("click", async () => {
        const answers = data.questions.map((_, i) => {
          const checked = document.querySelector('input[name="verify-' + i + '"]:checked');
          return checked ? Number(checked.value) : -1;
        });
        if (answers.includes(-1)) {
          showToast("Answer all questions before submitting.");
          return;
        }
        const submit = document.getElementById("submitVerificationBtn");
        submit.disabled = true;
        try {
          const checkedResult = await api("/skill-verification/" + encodeURIComponent(skill), {
            method: "POST",
            body: JSON.stringify({ answers })
          });
          result.insertAdjacentHTML("beforeend",
            '<div class="verification-outcome ' + (checkedResult.passed ? "passed" : "failed") + '">' +
            (checkedResult.passed
              ? "Skill verified — " + checkedResult.correct + "/" + checkedResult.total + " correct. Your verified status has been saved to your profile."
              : "Not verified yet — " + checkedResult.correct + "/" + checkedResult.total + " correct. Review the topic and try again.") +
            '</div>');
          submit.textContent = checkedResult.passed ? "Assessment passed" : "Try again";
          if (checkedResult.passed) submit.disabled = true;
          await loadSavedSkills();
          refreshSkillPicker();
          updateMatcher();
        } catch (error) {
          showToast(error.message);
          submit.disabled = false;
        }
      });
    } catch (error) {
      showToast(error.message);
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = "Start verification";
    }
  });
}

function setupResume() {
  const form = document.getElementById("resumeForm");
  const fileInput = document.getElementById("resumeFile");
  const fileName = document.getElementById("resumeFileName");
  const status = document.getElementById("resumeStatus");
  const result = document.getElementById("resumeResult");
  const score = document.getElementById("resumeScore");
  const hint = document.getElementById("resumeScoreHint");
  const skillsHost = document.getElementById("resumeSkills");
  const gapHost = document.getElementById("resumeGapResult");
  const uploadBtn = document.getElementById("resumeUploadBtn");
  const viewBtn = document.getElementById("resumeViewBtn");
  const deleteBtn = document.getElementById("resumeDeleteBtn");
  if (!form || !fileInput) return;

  fileInput.addEventListener("change", () => {
    fileName.textContent = fileInput.files?.[0]?.name || "Choose your resume";
  });

  async function renderResume() {
    if (!authToken || !currentUser) {
      status.textContent = "Login required";
      score.textContent = "—";
      return;
    }
    try {
      const data = await api("/resume");
      const resume = data.resume;
      if (!resume) {
        status.textContent = "Not uploaded";
        score.textContent = "—";
        hint.textContent = "Upload a resume to calculate your score.";
        viewBtn.disabled = true;
        deleteBtn.disabled = true;
        skillsHost.innerHTML = "";
        return;
      }
      status.textContent = "Analysed";
      score.textContent = String(resume.resume_score ?? 0) + "%";
      hint.textContent = resume.file_name + " · Updated " + new Date(resume.updated_at).toLocaleDateString();
      viewBtn.disabled = false;
      deleteBtn.disabled = false;
      const skills = String(resume.extracted_skills || "").split(",").map(s => s.trim()).filter(Boolean);
      skillsHost.innerHTML = '<div class="extracted-title">Skills detected from resume</div>' +
        (skills.length ? skills.map(s => '<span class="skill-pill">✓ ' + s + '</span>').join("") : '<span class="muted-small">No known skills detected yet.</span>');
      result.classList.remove("empty-state");
      result.innerHTML = '<strong>Resume intelligence is ready.</strong><small>Your document is stored with your account and the detected skills can be used for matching and gap analysis.</small>';
      await loadResumeGap();
    } catch {
      status.textContent = "Unavailable";
    }
  }

  async function loadResumeGap() {
    if (!authToken || !currentUser) return;
    try {
      const data = await api("/skill-gap");
      gapHost.classList.remove("empty-state");
      gapHost.innerHTML = '<div class="gap-summary"><strong>' + data.match + '%</strong><span>match with ' + (data.opportunity?.title || "a recommended opportunity") + '</span></div>' +
        '<div class="gap-columns"><div><b>Matched</b><p>' + (data.matched.length ? data.matched.map(s => '<span class="skill-pill">✓ ' + s + '</span>').join("") : '<span class="muted-small">None yet</span>') + '</p></div><div><b>Priority gaps</b><p>' + (data.missing.length ? data.missing.map(s => '<span class="gap-pill">Learn ' + s + '</span>').join("") : '<span class="muted-small">No major gaps for this opportunity.</span>') + '</p></div></div>';
    } catch {}
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!authToken || !currentUser) {
      window.skillsetuAuth?.openAuth("login");
      showToast("Please log in before uploading a resume.");
      return;
    }
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Resume must be 5 MB or smaller.");
      return;
    }
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading & analysing…";
    const body = new FormData();
    body.append("resume", file);
    try {
      const data = await api("/resume", { method: "POST", body });
      showToast("Resume analysed successfully.");
      fileInput.value = "";
      fileName.textContent = file.name;
      score.textContent = String(data.resume_score) + "%";
      status.textContent = "Analysed";
      await renderResume();
    } catch (error) {
      showToast(error.message);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload & Analyse Resume";
    }
  });

  viewBtn?.addEventListener("click", async () => {
    if (!authToken) return;
    window.open(API_BASE + "/resume/file", "_blank", "noopener");
  });

  deleteBtn?.addEventListener("click", async () => {
    if (!confirm("Remove your uploaded resume?")) return;
    try {
      await api("/resume", { method: "DELETE" });
      showToast("Resume removed.");
      await renderResume();
    } catch (error) { showToast(error.message); }
  });

  window.skillsetuResume = { render: renderResume };
  renderResume();
}

function setupProfileEditor() {
  const btn = document.getElementById("editProfileBtn");
  const editor = document.getElementById("profileEditor");
  const form = document.getElementById("profileForm");
  if (!btn || !editor || !form) return;
  btn.addEventListener("click", async () => {
    if (!authToken || !currentUser) {
      window.skillsetuAuth?.openAuth("login");
      showToast("Please log in to edit your profile.");
      return;
    }
    editor.classList.toggle("hidden");
    if (editor.classList.contains("hidden")) return;
    try {
      const data = await api("/profile");
      const p = data.profile || {};
      document.getElementById("profileBranchInput").value = p.branch || selectedBranch;
      document.getElementById("profileYearInput").value = String(p.year || selectedYear);
      document.getElementById("profileCgpaInput").value = p.cgpa ?? "";
      document.getElementById("profileCareerInput").value = p.career_direction || careerLabels[selectedBranch] || "";
      document.getElementById("profileLocationInput").value = p.preferred_location || "India · Remote";
      document.getElementById("profileOpenInput").checked = p.open_to_opportunities !== false;
    } catch {}
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!authToken) return;
    try {
      const payload = {
        branch: document.getElementById("profileBranchInput").value,
        year: Number(document.getElementById("profileYearInput").value),
        cgpa: document.getElementById("profileCgpaInput").value ? Number(document.getElementById("profileCgpaInput").value) : null,
        career_direction: document.getElementById("profileCareerInput").value,
        preferred_location: document.getElementById("profileLocationInput").value,
        open_to_opportunities: document.getElementById("profileOpenInput").checked
      };
      await api("/profile", { method: "PUT", body: JSON.stringify(payload) });
      selectedBranch = payload.branch;
      selectedYear = payload.year;
      localStorage.setItem("skillsetu_branch", selectedBranch);
      localStorage.setItem("skillsetu_year", String(selectedYear));
      updateBranchUI();
      await Promise.all([loadStudyUnits(), loadOpportunities()]);
      editor.classList.add("hidden");
      showToast("Profile updated successfully.");
    } catch (error) { showToast(error.message); }
  });
}

async function loadStudyUnits() {
  const list = document.getElementById("studyUnitsList");
  const resources = document.getElementById("studyResourcesList");
  const status = document.getElementById("studyStatus");
  const title = document.getElementById("careerTitle");
  const description = document.getElementById("careerDescription");
  const count = document.getElementById("studyCount");
  if (!list || !resources) return;

  document.querySelectorAll("#yearTabs .year-tab").forEach(tab => tab.classList.toggle("active", Number(tab.dataset.year) === selectedYear));
  if (title) title.textContent = selectedBranch + " · Year " + selectedYear;
  if (description) description.textContent = "Focused core topics and resources for this branch.";
  if (status) status.textContent = "Loading…";

  try {
    const data = await api("/study/units?branch=" + encodeURIComponent(selectedBranch) + "&year=" + selectedYear);
    const units = data.units || [];
    if (status) status.textContent = units.length + " core topics";
    if (count) count.innerHTML = units.length + '<span> topics</span>';

    list.innerHTML = units.map((unit, index) => `
      <div class="lesson ${index === 0 ? "current" : ""}">
        <span class="check">${index + 1}</span>
        <div><strong>${unit.title}</strong><small>${unit.description}</small></div>
        <a class="small-btn" href="${unit.resource_url}" target="_blank" rel="noopener">${unit.resource_type === "practice" ? "Practice" : "Open"}</a>
      </div>`).join("") || '<div class="empty-state">No study units found for this branch and year.</div>';

    resources.innerHTML = units.map(unit => `
      <div class="resource">
        <span class="resource-icon">${String(unit.resource_type || "TOPIC").slice(0,3).toUpperCase()}</span>
        <div><strong>${unit.title}</strong><small>${unit.description}</small></div>
        <a class="outline-btn" href="${unit.resource_url}" target="_blank" rel="noopener">Study</a>
      </div>`).join("");
  } catch {
    if (status) status.textContent = "Unavailable";
    list.innerHTML = '<div class="empty-state">Study material could not be loaded.</div>';
    resources.innerHTML = "";
  }
}

async function changeBranch(branch) {
  if (!branchSkills[branch]) return;
  selectedBranch = branch;
  localStorage.setItem("skillsetu_branch", selectedBranch);
  restoreLocalSkillsForBranch();
  refreshSkillPicker();
  refreshVerificationSkills();
  updateMatcher();
  updateBranchUI();

  const select = document.getElementById("careerSelect");
  if (select && select.value !== selectedBranch) select.value = selectedBranch;

  if (authToken && currentUser) {
    try {
      await api("/profile", { method: "PUT", body: JSON.stringify({ branch: selectedBranch }) });
    } catch {
      showToast("Branch changed on this device, but profile sync failed.");
    }
  }

  if (authToken && currentUser) await loadSavedSkills();
  else {
    refreshSkillPicker();
    updateMatcher();
  }
  await Promise.all([loadStudyUnits(), loadOpportunities()]);
}

async function changeYear(year) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 1 || numericYear > 4) return;

  selectedYear = numericYear;
  localStorage.setItem("skillsetu_year", String(selectedYear));
  updateBranchUI();
  document.querySelectorAll("#yearTabs .year-tab").forEach(tab => {
    tab.classList.toggle("active", Number(tab.dataset.year) === selectedYear);
  });

  if (authToken && currentUser) {
    try {
      await api("/profile", { method: "PUT", body: JSON.stringify({ year: selectedYear }) });
    } catch {
      showToast("Year changed on this device, but profile sync failed.");
    }
  }

  await loadStudyUnits();
}

async function restoreSession() {
  const select = document.getElementById("careerSelect");
  if (authToken) {
    try {
      const result = await api("/auth/me");
      currentUser = result.user;
      const profileData = await api("/profile");
      if (profileData.profile?.branch) selectedBranch = profileData.profile.branch;
      if (profileData.profile?.year) selectedYear = Number(profileData.profile.year);
    } catch {
      authToken = "";
      currentUser = null;
      localStorage.removeItem("skillsetu_token");
    }
  }
  if (select) select.value = selectedBranch;
  updateBranchUI();
  localStorage.setItem("skillsetu_branch", selectedBranch);
  localStorage.setItem("skillsetu_year", String(selectedYear));
  updateAuthButton();
  refreshSkillPicker();
  setupSkillVerification();
  setupResume();
  setupProfileEditor();
  await loadSavedSkills();
  refreshVerificationSkills();
  await loadStudyUnits();
  await loadOpportunities();
  await loadApplications();
}

(function initialize() {
  const careerSelect = document.getElementById("careerSelect");
  if (careerSelect) {
    careerSelect.addEventListener("change", event => {
      changeBranch(event.target.value);
    });
  }

  document.querySelectorAll("#yearTabs .year-tab").forEach(tab => {
    tab.addEventListener("click", () => changeYear(tab.dataset.year));
  });

  showView("overview");
  renderSkillMatcher();
  renderOpportunities();
  setupOpportunityFilters();
  restoreSession();
})();
