const views=[...document.querySelectorAll(".view")];
const nav=[...document.querySelectorAll(".nav-item")];
const toast=document.getElementById("toast");

function showToast(message){
  toast.textContent=message; toast.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>toast.classList.remove("show"),2200);
}
function showView(id){
  views.forEach(v=>v.classList.toggle("hidden",v.id!==id));
  nav.forEach(n=>n.classList.toggle("active",n.dataset.view===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
nav.forEach(n=>n.addEventListener("click",()=>showView(n.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));

document.getElementById("themeToggle").addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  document.getElementById("themeToggle").textContent=document.body.classList.contains("dark")?"☀":"☾";
});

document.querySelectorAll(".year-tab").forEach((tab,i)=>{
  tab.addEventListener("click",()=>{
    document.querySelectorAll(".year-tab").forEach(x=>x.classList.remove("active"));
    tab.classList.add("active");
    if(i<2) showToast("This year is available in your current study plan.");
    else showToast("Year "+(i+1)+" plan will unlock as you complete the current path.");
  });
});

document.querySelectorAll(".filter").forEach(f=>f.addEventListener("click",()=>{
  document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active")); f.classList.add("active");
  showToast("Opportunity filter applied: "+f.textContent);
}));

document.querySelectorAll(".apply-btn").forEach(b=>b.addEventListener("click",()=>{
  b.textContent="Application started"; b.disabled=true; showToast("Opportunity saved to your application pipeline.");
}));

document.querySelectorAll(".outline-btn,.small-btn").forEach(b=>b.addEventListener("click",()=>{
  showToast("This learning/resource action is ready for backend integration.");
}));

document.getElementById("filterBtn")?.addEventListener("click",e=>{
  e.currentTarget.textContent=e.currentTarget.textContent.includes("high")?"Showing high-match":"Show high-match only";
  showToast("Showing opportunities matched to your readiness.");
});

document.getElementById("careerSelect")?.addEventListener("change",e=>{
  showToast("Study path changed to "+e.target.value+".");
});

showView("overview");

const API_BASE = window.SKILLSETU_API_BASE || 'https://skillsetu-api-production.up.railway.app/api';
let authToken = localStorage.getItem('skillsetu_token') || '';

async function api(path, options={}) {
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if (authToken) headers.Authorization = 'Bearer ' + authToken;
  const res = await fetch(API_BASE + path, {...options, headers});
  const body = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body.data ?? body;
}

async function connectBackend() {
  if (!authToken) return;
  try {
    await api('/auth/me');
    showToast('Backend connected');
  } catch {
    authToken = '';
    localStorage.removeItem('skillsetu_token');
  }
}

const projectMilestones = [
  {name:"Reference-style responsive UI",detail:"Dashboard shell, navigation, cards and responsive styling",done:true},
  {name:"Student dashboard",detail:"Overview, study progress, skills and opportunity summary",done:true},
  {name:"Year-wise study path",detail:"Branch selection, Year 1–4 learning structure and resources",done:true},
  {name:"Skill intelligence",detail:"Skill map, demand vs readiness and skill-gap views",done:true},
  {name:"Internship & placement opportunities",detail:"Matched roles, employer information and application actions",done:true},
  {name:"Application pipeline",detail:"Saved, applied, screening, interview and offer tracking",done:true},
  {name:"Student skill profile",detail:"Academic record, career direction and project evidence",done:true},
  {name:"Authentication & role-based access",detail:"Student, institute, employer and admin login",done:true},
  {name:"Backend + database + APIs",detail:"Persistent users, materials, skills, opportunities and applications",done:true},
  {name:"Production deployment & live integrations",detail:"Real data, notifications, secure deployment and final testing",done:true}
];

function renderProjectProgress(){
  const total=projectMilestones.length;
  const completed=projectMilestones.filter(m=>m.done).length;
  const percent=Math.round((completed/total)*100);
  const ids=["projectPercent","projectPercentDetail"];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=percent+"%";});
  ["projectProgressBar","projectProgressBarDetail"].forEach(id=>{
    const el=document.getElementById(id); if(el)el.style.width=percent+"%";
  });
  const completedText=document.getElementById("projectCompletedText");
  if(completedText) completedText.textContent=completed+" of "+total+" milestones complete";
  const count=document.getElementById("milestoneCount");
  if(count) count.textContent=completed+" / "+total;
  const list=document.getElementById("milestoneList");
  if(list) list.innerHTML=projectMilestones.map((m,i)=>`
    <div class="milestone ${m.done?"complete":""}">
      <span class="milestone-icon">${m.done?"✓":i+1}</span>
      <div><strong>${m.name}</strong><small>${m.detail}</small></div>
      <span class="milestone-status">${m.done?"Completed":"Planned"}</span>
    </div>`).join("");
}
renderProjectProgress();

/* SkillSetu enhancement layer: skill matching, richer opportunities and recommendation reasons. */
(function(){
  const extraStyles = document.createElement("style");
  extraStyles.textContent = `
    .skill-matcher{margin-bottom:20px}
    .matcher-body{padding:18px 19px}
    .matcher-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .matcher-label{display:block;font-size:10px;font-weight:800;letter-spacing:.5px;color:#6f7781;margin-bottom:9px}
    .skill-picker{display:flex;flex-wrap:wrap;gap:7px}
    .skill-choice{border:1px solid var(--line);background:var(--white);color:var(--ink);border-radius:7px;padding:7px 10px;font-size:10px;cursor:pointer;transition:.15s}
    .skill-choice:hover{border-color:#aebfe9}
    .skill-choice.selected{background:var(--blue-soft);border-color:#b9c9f2;color:var(--blue);font-weight:700}
    .matcher-result{border:1px solid var(--line);border-radius:9px;background:#fafbfc;padding:14px}
    .matcher-score{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .matcher-score strong{font-size:22px;color:var(--green)}
    .matcher-score span{font-size:10px;color:var(--muted)}
    .gap-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 11px}
    .gap-chip{font-size:9px;padding:5px 7px;border-radius:5px;background:var(--orange-soft);color:var(--orange)}
    .match-next{font-size:10px;color:var(--muted);line-height:1.5}
    .match-next strong{color:var(--ink)}
    .recommendation-note{margin-top:12px;padding:10px 11px;border-radius:7px;background:var(--blue-soft);color:#42527a;font-size:10px;line-height:1.5}
    .job-card .why-match{margin:12px 0 14px;padding:10px;border:1px solid #e9ebef;border-radius:7px;background:#fafbfc}
    .why-match strong{display:block;font-size:10px;margin-bottom:6px}
    .why-match p{margin:0;font-size:9px;color:var(--muted);line-height:1.5}
    .why-match .match-points{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
    .why-match .match-points span{font-size:8px;padding:4px 6px;border-radius:4px;background:var(--green-soft);color:var(--green)}
    .opportunity-cards .job-card{transition:transform .15s,box-shadow .15s}
    .opportunity-cards .job-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(21,27,42,.07)}
    .branch-note{font-size:10px;color:var(--muted);margin-top:6px}
    @media(max-width:700px){.matcher-grid{grid-template-columns:1fr}}
    body.dark .matcher-result,body.dark .why-match{background:#121722;border-color:#2b3240}
    body.dark .recommendation-note{color:#c3cbe0}
  `;
  document.head.appendChild(extraStyles);

  const opportunities = [
    {logo:"NC",tone:"",type:"Internship",title:"Frontend Engineer Intern",company:"Nimbus Cloud Labs",place:"Pune",pay:"₹20,000 / mo",duration:"3 months",match:89,skills:["React","JavaScript","SQL"],reason:"Strong fit for your web-development path.",missing:["Cloud"],branch:"CSE / IT"},
    {logo:"PH",tone:"purple",type:"Internship",title:"LLM Applications Intern",company:"Prayag Health AI",place:"Hyderabad",pay:"₹44,000 / mo",duration:"6 months",match:82,skills:["Python","AI","APIs"],reason:"Matches your Python foundation and AI direction.",missing:["Deep Learning"],branch:"AI / Data"},
    {logo:"AS",tone:"orange",type:"Placement",title:"Software Engineer — Platform",company:"Aeris Systems",place:"Bengaluru",pay:"₹24.8 LPA",duration:"Full-time",match:76,skills:["DSA","Backend","Git"],reason:"Builds directly on your DSA and backend readiness.",missing:["Cloud"],branch:"CSE / IT"},
    {logo:"SA",tone:"",type:"Internship",title:"Data Analyst Intern",company:"Sangam Analytics",place:"Noida",pay:"₹18,000 / mo",duration:"4 months",match:78,skills:["SQL","Python","Power BI"],reason:"Your SQL level is a strong starting point for analytics.",missing:["Power BI"],branch:"AI / Data"},
    {logo:"ID",tone:"purple",type:"Internship",title:"Cloud Support Intern",company:"Indus Digital",place:"Remote",pay:"₹22,000 / mo",duration:"3 months",match:71,skills:["Cloud","Linux","Networking"],reason:"A practical route to close your current cloud gap.",missing:["Cloud","Linux"],branch:"CSE / IT"},
    {logo:"ME",tone:"orange",type:"Internship",title:"Mechanical Design Intern",company:"Mitra Engineering",place:"Pune",pay:"₹16,000 / mo",duration:"3 months",match:68,skills:["AutoCAD","CAD","Manufacturing"],reason:"A branch-specific pathway for mechanical engineering learners.",missing:["AutoCAD"],branch:"Mechanical"},
    {logo:"EL",tone:"",type:"Internship",title:"Embedded Systems Intern",company:"Electra Labs",place:"Bengaluru",pay:"₹21,000 / mo",duration:"4 months",match:72,skills:["C","Microcontrollers","Embedded"],reason:"Combines programming fundamentals with electronics practice.",missing:["Microcontrollers"],branch:"Electronics"},
    {logo:"PW",tone:"purple",type:"Placement",title:"Electrical Systems Trainee",company:"PowerGrid Works",place:"Lucknow",pay:"₹5.8 LPA",duration:"Full-time",match:69,skills:["MATLAB","Power Systems","Electrical"],reason:"A structured entry route for electrical engineering skills.",missing:["MATLAB"],branch:"Electrical"},
    {logo:"CB",tone:"orange",type:"Internship",title:"Civil Project Intern",company:"CivicBuild India",place:"Lucknow",pay:"₹15,000 / mo",duration:"3 months",match:66,skills:["AutoCAD","Surveying","Estimation"],reason:"Adds industry exposure to core civil-engineering skills.",missing:["Estimation"],branch:"Civil"},
    {logo:"AI",tone:"",type:"Internship",title:"Machine Learning Intern",company:"Astra Intelligence",place:"Remote",pay:"₹30,000 / mo",duration:"5 months",match:74,skills:["Python","ML","SQL"],reason:"A next-step role after strengthening your ML fundamentals.",missing:["ML"],branch:"AI / Data"},
    {logo:"NX",tone:"purple",type:"Internship",title:"QA Automation Intern",company:"NextWave Tech",place:"Hyderabad",pay:"₹19,000 / mo",duration:"3 months",match:75,skills:["JavaScript","Testing","Git"],reason:"Uses your JavaScript base while adding test automation.",missing:["Testing"],branch:"CSE / IT"},
    {logo:"EC",tone:"orange",type:"Internship",title:"IoT Solutions Intern",company:"EdgeCircuit",place:"Ahmedabad",pay:"₹20,000 / mo",duration:"4 months",match:70,skills:["C","IoT","Sensors"],reason:"Introduces applied embedded and IoT project experience.",missing:["IoT"],branch:"Electronics"}
  ];

  const skills = ["JavaScript","SQL","React","Python","DSA","Git","Cloud","AI","APIs","Power BI","Testing","C","MATLAB","AutoCAD"];
  const currentSkills = new Set(["JavaScript","SQL","React","Python","DSA","Git"]);
  const skillAliases = {
    "DSA":["DSA","Data Structures","Algorithms"],
    "AI":["AI","Machine Learning","ML"],
    "C":["C","Embedded"]
  };

  function skillMatches(roleSkill){
    if(currentSkills.has(roleSkill)) return true;
    const aliases=skillAliases[roleSkill]||[roleSkill];
    return aliases.some(s=>currentSkills.has(s));
  }

  function calculateMatch(job){
    const matched=job.skills.filter(skillMatches).length;
    const base=Math.round((matched/job.skills.length)*100);
    return Math.max(55,Math.min(97,Math.round((base*.7)+(job.match*.3))));
  }

  function renderMatcher(){
    const host=document.getElementById("skills");
    if(!host || document.getElementById("skillMatcher")) return;
    const panel=document.createElement("section");
    panel.className="panel skill-matcher";
    panel.id="skillMatcher";
    panel.innerHTML=`
      <div class="panel-head">
        <div><h2>Smart skill matching</h2><p>Select the skills you already have. SkillSetu will show the next skill gap and matching opportunities.</p></div>
        <span class="status-pill">Live demo</span>
      </div>
      <div class="matcher-body">
        <div class="matcher-grid">
          <div>
            <span class="matcher-label">YOUR CURRENT SKILLS</span>
            <div class="skill-picker" id="skillPicker"></div>
          </div>
          <div class="matcher-result" id="matcherResult"></div>
        </div>
        <div class="recommendation-note"><strong>How it works:</strong> SkillSetu compares your selected skills with role requirements, highlights missing skills and calculates a readiness match.</div>
      </div>`;
    host.insertBefore(panel,host.querySelector(".two-col"));
    const picker=panel.querySelector("#skillPicker");
    skills.forEach(skill=>{
      const btn=document.createElement("button");
      btn.className="skill-choice"+(currentSkills.has(skill)?" selected":"");
      btn.textContent=skill;
      btn.type="button";
      btn.addEventListener("click",()=>{
        if(currentSkills.has(skill)) currentSkills.delete(skill); else currentSkills.add(skill);
        btn.classList.toggle("selected",currentSkills.has(skill));
        updateMatcher();
      });
      picker.appendChild(btn);
    });
    updateMatcher();
  }

  function updateMatcher(){
    const result=document.getElementById("matcherResult");
    if(!result) return;
    const ranked=opportunities.map(job=>({...job,score:calculateMatch(job)})).sort((a,b)=>b.score-a.score);
    const top=ranked[0];
    const matched=top.skills.filter(skillMatches);
    const missing=top.skills.filter(s=>!skillMatches(s));
    result.innerHTML=`
      <div class="matcher-score"><div><span>BEST CURRENT MATCH</span><strong>${top.score}%</strong></div><span>${top.title}</span></div>
      <div class="match-next"><strong>Matched skills:</strong> ${matched.length?matched.join(" · "):"Add a skill to begin"}</div>
      <div class="gap-chips">${(missing.length?missing:["No immediate gap"]).map(s=>`<span class="gap-chip">${missing.length?"Missing: ":""}${s}</span>`).join("")}</div>
      <div class="match-next"><strong>Next step:</strong> Learn ${missing[0]||"advanced skills"} to unlock more relevant roles.</div>`;
  }

  function renderOpportunities(){
    const host=document.querySelector("#opportunities .opportunity-cards");
    if(!host) return;
    host.innerHTML=opportunities.map(job=>{
      const score=calculateMatch(job);
      const points=job.skills.filter(skillMatches).slice(0,3);
      const missing=job.skills.filter(s=>!skillMatches(s)).slice(0,2);
      return `
        <article class="job-card" data-branch="${job.branch}" data-score="${score}">
          <div class="job-top"><span class="company-logo ${job.tone}">${job.logo}</span><span class="tag">${job.type}</span></div>
          <h3>${job.title}</h3><p>${job.company} · ${job.place}</p>
          <div class="job-meta"><span>${job.pay}</span><span>${job.duration}</span><strong>${score}% match</strong></div>
          <div class="skill-tags">${job.skills.map(s=>`<span>${s}</span>`).join("")}</div>
          <div class="why-match"><strong>Why recommended?</strong><p>${job.reason}</p><div class="match-points">${points.map(s=>`<span>✓ ${s}</span>`).join("")}${missing.slice(0,1).map(s=>`<span style="background:var(--orange-soft);color:var(--orange)">Gap: ${s}</span>`).join("")}</div></div>
          <button class="primary-btn apply-btn">View & apply</button>
        </article>`;
    }).join("");
    host.querySelectorAll(".apply-btn").forEach(b=>b.addEventListener("click",()=>{
      applyOpportunity(b.closest(".job-card"));
    }));
  }

  function enhanceOpportunityFilters(){
    const bar=document.querySelector("#opportunities .filter-bar");
    const button=document.getElementById("filterBtn");
    if(!bar || !button) return;
    let highOnly=false;
    button.addEventListener("click",()=>{
      highOnly=!highOnly;
      document.querySelectorAll("#opportunities .job-card").forEach(card=>{
        card.style.display=highOnly && Number(card.dataset.score)<75?"none":"";
      });
      button.textContent=highOnly?"Showing 75%+ matches":"Show high-match only";
      showToast(highOnly?"Showing roles with 75%+ readiness match.":"Showing all opportunities.");
    });
    bar.querySelectorAll(".filter").forEach(filter=>{
      filter.addEventListener("click",()=>{
        const label=filter.textContent.trim();
        document.querySelectorAll("#opportunities .job-card").forEach(card=>{
          const jobBranch=card.dataset.branch||"";
          const score=Number(card.dataset.score||0);
          let visible=true;
          if(label==="Internships") visible=card.querySelector(".tag")?.textContent==="Internship";
          else if(label==="Placements") visible=card.querySelector(".tag")?.textContent==="Placement";
          else if(label==="Remote") visible=card.textContent.includes("Remote");
          else if(label==="AI / Data") visible=jobBranch==="AI / Data";
          else if(label==="Software") visible=jobBranch==="CSE / IT";
          card.style.display=visible?"":"none";
          if(highOnly && score<75) card.style.display="none";
        });
      });
    });
  }

  renderMatcher();
  renderOpportunities();
  enhanceOpportunityFilters();
})();


/* Student authentication and persistent application flow. */
(function(){
  const authModal=document.getElementById("authModal");
  const authButton=document.getElementById("authButton");
  const authClose=document.getElementById("authClose");
  const authSwitch=document.getElementById("authSwitch");
  const loginForm=document.getElementById("loginForm");
  const registerForm=document.getElementById("registerForm");
  const authTitle=document.getElementById("authTitle");
  const authSubtitle=document.getElementById("authSubtitle");
  const authStyle=document.createElement("style");

  authStyle.textContent=`
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

  let registerMode=false;

  function openAuth(mode){
    if(mode==="register") setMode(true); else setMode(false);
    authModal.classList.remove("hidden");
  }

  function closeAuth(){ authModal.classList.add("hidden"); }

  function setMode(register){
    registerMode=register;
    loginForm.classList.toggle("hidden",register);
    registerForm.classList.toggle("hidden",!register);
    authTitle.textContent=register?"Create Student Account":"Student Login";
    authSubtitle.textContent=register?"Create an account so your profile, applications and messages stay connected.":"Log in with your email to save your profile and applications.";
    authSwitch.textContent=register?"Already have an account? Login":"New student? Create an account";
  }

  authButton?.addEventListener("click",()=>{
    if(authToken && window.skillsetuUser){
      authToken="";
      window.skillsetuUser=null;
      localStorage.removeItem("skillsetu_token");
      authButton.querySelector("span:last-of-type").textContent="Student Login";
      showToast("You have been logged out.");
      return;
    }
    openAuth("login");
  });
  authClose?.addEventListener("click",closeAuth);
  authModal?.querySelector("[data-close-auth]")?.addEventListener("click",closeAuth);
  authSwitch?.addEventListener("click",()=>setMode(!registerMode));

  async function login(event){
    event.preventDefault();
    try{
      const result=await api("/auth/login",{method:"POST",body:JSON.stringify({
        email:document.getElementById("loginEmail").value,
        password:document.getElementById("loginPassword").value
      })});
      authToken=result.token;
      window.skillsetuUser=result.user;
      localStorage.setItem("skillsetu_token",authToken);
      closeAuth();
      updateAuthButton();
      showToast("Welcome back, "+result.user.name+"!");
    }catch(error){ showToast(error.message); }
  }

  async function register(event){
    event.preventDefault();
    try{
      const result=await api("/auth/register",{method:"POST",body:JSON.stringify({
        name:document.getElementById("registerName").value,
        email:document.getElementById("registerEmail").value,
        password:document.getElementById("registerPassword").value,
        role:"student"
      })});
      authToken=result.token;
      window.skillsetuUser=result.user;
      localStorage.setItem("skillsetu_token",authToken);
      closeAuth();
      updateAuthButton();
      showToast("Student account created successfully.");
    }catch(error){ showToast(error.message); }
  }

  loginForm?.addEventListener("submit",login);
  registerForm?.addEventListener("submit",register);

  function updateAuthButton(){
    const label=authButton?.querySelector("span:last-of-type");
    const avatar=authButton?.querySelector(".mini-avatar");
    if(!label) return;
    if(authToken && window.skillsetuUser){
      label.textContent=window.skillsetuUser.name;
      if(avatar) avatar.textContent=(window.skillsetuUser.name||"ST").slice(0,2).toUpperCase();
    }else{
      label.textContent="Student Login";
      if(avatar) avatar.textContent="ST";
    }
  }

  window.applyOpportunity=async function(card){
    if(!authToken || !window.skillsetuUser){
      openAuth("login");
      showToast("Please log in before applying.");
      return;
    }
    const title=card?.querySelector("h3")?.textContent?.trim();
    if(!title) return;
    const buttons=card.querySelectorAll(".apply-btn");
    buttons.forEach(b=>{b.disabled=true;b.textContent="Applying…";});
    try{
      const data=await api("/opportunities");
      const job=data.opportunities.find(item=>item.title===title);
      if(!job) throw new Error("This opportunity is not available in the database yet.");
      const result=await api("/applications",{method:"POST",body:JSON.stringify({opportunity_id:job.id})});
      buttons.forEach(b=>{b.textContent="Applied ✓";});
      showToast(result.emailSent?"Applied! Confirmation email sent.":"Application saved to your account.");
    }catch(error){
      buttons.forEach(b=>{b.disabled=false;b.textContent="View & apply";});
      showToast(error.message);
    }
  };

  async function restoreSession(){
    if(!authToken){ updateAuthButton(); return; }
    try{
      const result=await api("/auth/me");
      window.skillsetuUser=result.user;
      updateAuthButton();
    }catch{
      authToken="";
      localStorage.removeItem("skillsetu_token");
      updateAuthButton();
    }
  }

  window.skillsetuAuth={openAuth,closeAuth,restoreSession};
  restoreSession();
})();