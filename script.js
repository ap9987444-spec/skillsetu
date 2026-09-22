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
