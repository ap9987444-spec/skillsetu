/* SkillSetu Career Guidance AI — standalone widget; existing app logic is untouched */
(() => {
  const API = "https://skillsetu-api-live-production.up.railway.app/api";
  const launcher = document.getElementById("careerAiLauncher");
  const panel = document.getElementById("careerAiPanel");
  const close = document.getElementById("careerAiClose");
  const form = document.getElementById("careerAiForm");
  const input = document.getElementById("careerAiInput");
  const messages = document.getElementById("careerAiMessages");
  const send = document.getElementById("careerAiSend");
  const branch = document.getElementById("careerAiBranch");
  const year = document.getElementById("careerAiYear");
  const target = document.getElementById("careerAiTarget");
  const skills = document.getElementById("careerAiSkills");
  if (!launcher || !panel || !form || !messages) return;

  const token = () => localStorage.getItem("skillsetu_token") || "";
  function addMessage(role, text) {
    const item = document.createElement("div");
    item.className = "career-ai-message " + role;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  }
  function showPanel(show) {
    panel.classList.toggle("hidden", !show);
    launcher.setAttribute("aria-expanded", String(show));
    if (show) input?.focus();
  }
  launcher.addEventListener("click", () => showPanel(panel.classList.contains("hidden")));
  close?.addEventListener("click", () => showPanel(false));

  const starter = "Hi! I’m your SkillSetu Career Guide. Tell me your branch, year, target role and current skills. I can identify likely skill gaps and create a practical study roadmap. Fill in the profile above, then choose “Analyse my skill gaps” or “Build my study roadmap”.";
  addMessage("assistant", starter);

  function contextText() {
    return [
      "Student branch: " + branch.value,
      "Current year: " + year.value,
      "Target career/role: " + (target.value.trim() || "Recommend suitable options for my branch"),
      "Current skills and experience: " + (skills.value.trim() || "Not provided; ask me a few questions before assuming skill levels.")
    ].join("\n");
  }
  async function ask(question) {
    const message = String(question || "").trim();
    if (!message) return;
    addMessage("user", message);
    input.value = "";
    send.disabled = true;
    send.textContent = "…";
    const pending = addMessage("assistant", "Reviewing your details and preparing guidance…");
    try {
      const headers = { "Content-Type": "application/json" };
      if (token()) headers.Authorization = "Bearer " + token();
      const response = await fetch(API + "/career-ai/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ context: contextText(), message })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Career guidance is temporarily unavailable.");
      pending.textContent = result.data?.reply || result.reply || "I couldn't generate a response. Please try again.";
    } catch (error) {
      pending.textContent = error.message + (error.message.toLowerCase().includes("not configured") ? " The site owner needs to add GROQ_API_KEY to the Railway API service variables." : "");
    } finally {
      send.disabled = false;
      send.textContent = "Send";
      messages.scrollTop = messages.scrollHeight;
    }
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    ask(input.value);
  });
  document.getElementById("careerAiGapBtn")?.addEventListener("click", () => ask("Analyse my skill gaps for my target role. Separate skills I already have from missing skills, explain why each gap matters, and suggest a way to check my current level. Then give me the three highest-priority next steps."));
  document.getElementById("careerAiRoadmapBtn")?.addEventListener("click", () => ask("Build a personalized study roadmap for my branch, year, target role and current skills. Organize it into weekly stages for the next 8 weeks, with topics, practice tasks, one small project, and checkpoints. Start with foundations appropriate to my year, prioritize skill gaps, and include free learning resources by name or stable URL where you know them. If my skills are unclear, state assumptions and ask me to verify them."));
})();