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
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
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

const currentSkills = new Set(["JavaScript","SQL","React","Python","DSA","Git"]);

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
    button.textContent = skill;
    button.addEventListener("click", () => {
      currentSkills.has(skill) ? currentSkills.delete(skill) : currentSkills.add(skill);
      button.classList.toggle("selected", currentSkills.has(skill));
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

  const ranked = opportunities.map(job => ({ ...job, score: calculateMatch(job), skills: getJobSkills(job) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const matched = top.skills.filter(skillMatches);
  const missing = top.skills.filter(skill => !skillMatches(skill));

  result.innerHTML = `
    <div class="matcher-score"><div><span>BEST BRANCH MATCH</span><strong>${top.score}%</strong></div><span>${top.title}</span></div>
    <div class="match-next"><strong>Matched skills:</strong> ${matched.length ? matched.join(" · ") : "Add a branch skill"}</div>
    <div class="gap-chips">${(missing.length ? missing : ["No immediate gap"]).map(skill => `<span class="gap-chip">${missing.length ? "Missing: " : ""}${skill}</span>`).join("")}</div>
    <div class="match-next"><strong>Next step:</strong> ${missing.length ? "Build " + missing[0] + "." : "Keep strengthening your core skills."}</div>`;
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
  refreshSkillPicker();
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
