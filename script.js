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

const projectMilestones = [
  {name:"Reference-style responsive UI",detail:"Dashboard shell, navigation, cards and responsive styling",done:true},
  {name:"Student dashboard",detail:"Overview, study progress, skills and opportunity summary",done:true},
  {name:"Year-wise study path",detail:"Branch selection, Year 1–4 learning structure and resources",done:true},
  {name:"Skill intelligence",detail:"Skill map, demand vs readiness and skill-gap views",done:true},
  {name:"Internship & placement opportunities",detail:"Matched roles, employer information and application actions",done:true},
  {name:"Application pipeline",detail:"Saved, applied, screening, interview and offer tracking",done:true},
  {name:"Student skill profile",detail:"Academic record, career direction and project evidence",done:true},
  {name:"Authentication & role-based access",detail:"Student, institute, employer and admin login",done:false},
  {name:"Backend + database + APIs",detail:"Persistent users, materials, skills, opportunities and applications",done:false},
  {name:"Production deployment & live integrations",detail:"Real data, notifications, secure deployment and final testing",done:false}
];

function renderProjectProgress(){
  const total=projectMilestones.length;
  const completed=projectMilestones.filter(m=>m.done).length;
  const percent=Math.round((completed/total)*100);
  const ids=["projectPercent","projectPercentDetail"];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=percent+"%";});
  ["projectProgressBar","projectProgressBarDetail"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.width=percent+"%";
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
