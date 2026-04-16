// ═══════════════════════════════════════════════════════════
// Groq AI Helper — Server-side only
// ═══════════════════════════════════════════════════════════
// Reusable function to call the Groq API for AI tasks like
// job scoring, cover note generation, and cold emails.
// This file should NEVER be imported from client components.
// ═══════════════════════════════════════════════════════════

/**
 * Sends a prompt to the Groq AI API and returns the response text.
 * Uses the Llama 3.3 70B model for high-quality responses.
 *
 * @param prompt - The full prompt to send to the AI
 * @param maxTokens - Maximum response length (default 4000)
 * @returns The AI's response as a string
 * @throws Error if API key is missing or request fails
 */
export async function callGroq(prompt: string, maxTokens = 4000): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not configured in .env.local');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error?.message || `Groq API error: HTTP ${res.status}`);
  }

  const d = await res.json();
  return d.choices[0].message.content;
}
