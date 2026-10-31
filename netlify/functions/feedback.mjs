import { streamJson } from "../lib/stream.mjs";

const SHAPE = `{
 "overall_score": <number 0-10>,
 "fluency": {"score": <0-10>, "feedback": "<2-4 sentences>", "tips": ["<tip>", "<tip>"]},
 "pronunciation": {"score": <0-10>, "feedback": "<2-3 sentences>", "words_to_practice": [{"word": "<word>", "tip": "<stress/sound tip>"}]},
 "grammar": {"score": <0-10>, "feedback": "<2-3 sentences>", "errors": [{"original": "<what they said>", "corrected": "<fixed version>", "explanation": "<short rule>"}]},
 "vocabulary_and_content": {"feedback": "<topic coverage and word choice>", "suggestions": [{"instead_of": "<word/phrase used>", "try": "<better option>", "example": "<short example sentence>"}]},
 "corrected_transcript": "<the whole speech with every grammar error fixed, keeping the speaker's ideas and style>",
 "strengths": ["<strength>", "<strength>"],
 "next_steps": ["<practice suggestion>", "<practice suggestion>"]
}`;

const LEVEL = {
  Beginner: "Learner is a BEGINNER: use very simple language, be extra gentle, report only the 5 most important grammar errors.",
  Intermediate: "Learner is INTERMEDIATE: be clear and balanced; list every grammar error (max 12).",
  Advanced: "Learner is ADVANCED: be demanding and nuanced (idiom, register, precision); list every grammar error (max 15).",
};

const num = (x) => typeof x === "number" && isFinite(x);
const arr = (x) => Array.isArray(x);
function valid(j) {
  return j && num(j.overall_score) &&
    j.fluency && num(j.fluency.score) && typeof j.fluency.feedback === "string" && arr(j.fluency.tips) &&
    j.pronunciation && num(j.pronunciation.score) && arr(j.pronunciation.words_to_practice) &&
    j.grammar && num(j.grammar.score) && arr(j.grammar.errors) &&
    j.vocabulary_and_content && typeof j.vocabulary_and_content.feedback === "string" &&
    arr(j.vocabulary_and_content.suggestions) &&
    typeof j.corrected_transcript === "string" && arr(j.strengths) && arr(j.next_steps);
}
const clamp = (x) => Math.max(0, Math.min(10, Math.round(x * 10) / 10));

async function askLLM(prompt) {
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 3500, messages: [{ role: "user", content: prompt }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error("Claude error: " + (d?.error?.message || r.status));
    return d.content?.map((c) => c.text || "").join("") || "";
  }
  if (process.env.GEMINI_API_KEY) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error("Gemini error: " + (d?.error?.message || r.status));
    return d.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  }
  throw new Error("Server is missing ANTHROPIC_API_KEY (or GEMINI_API_KEY).");
}

export default async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  let body = {};
  try { body = await req.json(); } catch { /* handled below */ }
  return streamJson(async () => {
    const { topic, difficulty = "Intermediate", transcript, metrics } = body;
    if (!transcript) throw new Error("No transcript received.");
    const prompt = `You are a warm, encouraging English speaking coach. A learner spoke for up to 2 minutes on a topic.
${LEVEL[difficulty] || LEVEL.Intermediate}

TOPIC: ${topic}

TRANSCRIPT (from speech-to-text, punctuation added by the recogniser, ignore punctuation errors):
"""${String(transcript).slice(0, 8000)}"""

OBJECTIVE METRICS (computed from word timestamps):
${JSON.stringify(metrics)}

Rules:
- Use the metrics for fluency (≈110-160 words per minute is natural; many long pauses/fillers lower the score).
- Pronunciation is INFERRED from the transcript and recognition confidence only; you did not hear the audio. Choose 3-6 words to practice from the low-confidence segments or from words that are commonly hard to pronounce. Never claim you heard them.
- Keep the speaker's own ideas in corrected_transcript. Only fix grammar.
- Be encouraging but honest. Use plain, friendly language.

Reply with ONLY valid JSON, no markdown, in exactly this shape:
${SHAPE}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await askLLM(prompt);
      try {
        const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        if (valid(j)) {
          for (const k of ["overall_score"]) j[k] = clamp(j[k]);
          for (const k of ["fluency", "pronunciation", "grammar"]) j[k].score = clamp(j[k].score);
          return j;
        }
      } catch { /* retry */ }
    }
    throw new Error("The AI gave an unreadable answer. Please tap Retry.");
  });
};
export const config = { path: "/api/feedback" };
