import { streamJson } from "../lib/stream.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  let file;
  try { file = (await req.formData()).get("audio"); } catch { /* handled below */ }
  return streamJson(async () => {
    if (!file) throw new Error("No audio received.");
    const groq = process.env.GROQ_API_KEY, openai = process.env.OPENAI_API_KEY;
    if (!groq && !openai) throw new Error("Server is missing GROQ_API_KEY or OPENAI_API_KEY.");

    const fd = new FormData();
    fd.append("file", file, file.name || "speech.webm");
    fd.append("model", groq ? "whisper-large-v3-turbo" : "whisper-1");
    fd.append("response_format", "verbose_json");
    fd.append("timestamp_granularities[]", "word");
    fd.append("timestamp_granularities[]", "segment");
    fd.append("language", "en");
    fd.append("temperature", "0");
    // Whisper tends to delete fillers; this prompt nudges it to keep them.
    fd.append("prompt", "Umm, so, uh, I think, like, you know, it was, uh, really good.");

    const r = await fetch(
      groq ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions",
      { method: "POST", headers: { Authorization: `Bearer ${groq || openai}` }, body: fd },
    );
    const d = await r.json();
    if (!r.ok) throw new Error("Speech-to-text error: " + (d?.error?.message || r.status));
    return {
      text: d.text || "",
      duration: d.duration,
      words: (d.words || []).map((w) => ({ word: w.word, start: w.start, end: w.end })),
      segments: (d.segments || []).map((s) => ({ start: s.start, end: s.end, text: s.text, avg_logprob: s.avg_logprob })),
    };
  });
};
export const config = { path: "/api/transcribe" };
