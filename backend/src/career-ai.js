import express from 'express';

const router = express.Router();

router.post('/chat', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI career guidance is not configured yet.' });
  }

  const message = String(req.body?.message || '').trim();
  const context = String(req.body?.context || '').trim().slice(0, 5000);
  if (!message) return res.status(400).json({ error: 'Please enter a question.' });
  if (message.length > 2000) return res.status(400).json({ error: 'Please keep your question under 2,000 characters.' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.35,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: [
              'You are SkillSetu Career Guide, a supportive academic and career mentor for college students in India.',
              'Help students understand career options, assess likely skill gaps, and build realistic study roadmaps suited to their branch and year.',
              'Use the provided student context, but do not assume unreported skills or claim to have tested or verified their ability.',
              'When analyzing gaps, clearly label known skills, likely missing skills, and questions that still need confirmation.',
              'When creating a roadmap, prioritize fundamentals first, then practice, a small portfolio project, and interview or internship preparation.',
              'Prefer free or low-cost learning resources and practical weekly goals. Adapt to non-CS branches; do not force software topics onto engineering branches where they are not relevant.',
              'Use concise headings and bullet points. Explain why each priority matters. Do not guarantee a job, placement, internship, or score.',
              'Do not invent live vacancies, employer requirements, statistics, or resource URLs. Ask a short follow-up if essential information is missing.',
              'Do not request passwords, OTPs, government IDs, or other sensitive personal information.'
            ].join(' ')
          },
          { role: 'user', content: 'Student context:\n' + context + '\n\nRequest:\n' + message }
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Groq career AI error:', response.status, payload?.error?.message || 'Provider request failed');
      return res.status(502).json({ error: 'The AI provider could not answer right now. Please try again shortly.' });
    }

    const reply = payload?.choices?.[0]?.message?.content;
    if (!reply) return res.status(502).json({ error: 'The AI returned an empty response. Please try again.' });
    res.json({ data: { reply } });
  } catch (error) {
    console.error('Career AI request failed:', error?.message || error);
    res.status(502).json({ error: 'Career guidance is temporarily unavailable. Please try again shortly.' });
  }
});

export default router;
