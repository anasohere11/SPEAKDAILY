"use strict";
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

/* ---------------- Topics (55) ---------------- */
const TOPICS = {
  "Personal experience": [
    "Describe the best day you have had this year.", "Talk about a time you felt really proud of yourself.",
    "Tell the story of a trip that did not go as planned.", "Describe a mistake that taught you something important.",
    "Talk about your first day at a new school or job.", "Tell us about a time someone helped you when you needed it.",
    "Describe a meal you will never forget.", "Talk about a skill you learned the hard way.",
    "What is your earliest childhood memory?", "Describe a time you had to make a difficult decision.", "Talk about a tradition in your family."],
  "Opinion": [
    "Is social media good or bad for young people?", "Should students wear school uniforms?",
    "Is it better to live in a city or in the countryside?", "Do you think people read enough books today?",
    "Is working from home better than working in an office?", "Should everyone learn to cook?",
    "Is money the key to happiness?", "Are online friendships as real as face-to-face ones?",
    "Should homework be abolished?", "Is it better to be an early bird or a night owl?", "Are video games a waste of time?"],
  "Current issues": [
    "How is artificial intelligence changing the way we work and study?", "What can ordinary people do to protect the environment?",
    "Should cities ban cars from their centres?", "How has smartphone use changed our daily lives?",
    "Is online shopping hurting local shops?", "Should junk food be taxed?",
    "How can we make public transport better?", "Is remote learning here to stay?",
    "What is the biggest challenge facing young people today?", "Should the school week be four days long?", "How important is it to learn a second language?"],
  "Hypothetical situation": [
    "If you could live in any country for a year, where would you go and why?", "What would you do if you won a million dollars tomorrow?",
    "If you could have dinner with anyone from history, who would it be?", "Imagine you can speak every language in the world. How would you use it?",
    "If you were the leader of your country for one day, what would you change?", "What would you do if you woke up and everyone else had disappeared?",
    "If you could go back in time and give your younger self advice, what would it be?", "Imagine you could invent one useful machine. What would it do?",
    "If you could master any job instantly, what would you choose?", "What would you do if you could be invisible for a day?", "If you had a free month with no responsibilities, how would you spend it?"],
  "Describe a person, place or event": [
    "Describe a person who has had a big influence on your life.", "Describe your favourite place in your hometown.",
    "Describe a festival or celebration you enjoy.", "Describe your dream home.",
    "Describe a teacher you remember well.", "Describe a place you would love to visit one day.",
    "Describe a person you admire from public life.", "Describe a memorable concert, match or show you attended.",
    "Describe your perfect weekend.", "Describe an object that is special to you.", "Describe your daily routine on a busy day."],
};
const HINT = {
  Beginner: "Use short, simple sentences. Try for 6–8 sentences.",
  Intermediate: "Give your opinion and at least one example.",
  Advanced: "Develop your argument with reasons, examples and a counterpoint.",
};
let bag = [];
const nextTopic = () => {
  if (!bag.length) {
    bag = Object.entries(TOPICS).flatMap(([c, a]) => a.map((t) => ({ c, t })));
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  }
  return bag.pop(); // never repeats until all topics were used
};

/* ---------------- Storage ---------------- */
const load = () => { try { return JSON.parse(localStorage.sd_sessions || "[]"); } catch { return []; } };
const store = (list) => { try { localStorage.sd_sessions = JSON.stringify(list); } catch { /* storage full or blocked */ } };
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("sd", 1); r.onupgradeneeded = () => r.result.createObjectStore("a"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const putAudio = async (k, v) => { try { (await idb()).transaction("a", "readwrite").objectStore("a").put(v, k); } catch { /* ignore */ } };
const getAudio = async (k) => { try { const d = await idb(); return await new Promise((r) => { const q = d.transaction("a").objectStore("a").get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch { return null; } };

/* ---------------- Navigation & state ---------------- */
let topic, level = "Intermediate", timer, raf, rec, stream, ac, an, chunks = [], cancelled = false, t0 = 0, lastBlob, cache = {};
const show = (id) => { $$(".view").forEach((v) => (v.hidden = v.id !== id)); scrollTo(0, 0); if (id === "home") renderHome(); if (id === "history") renderHistory(); };
function stopAll() {
  clearInterval(timer); cancelAnimationFrame(raf); cancelled = true;
  try { if (rec && rec.state !== "inactive") rec.stop(); } catch { /* */ }
  stream?.getTracks().forEach((t) => t.stop()); ac?.close().catch(() => {});
  rec = stream = ac = null; speechSynthesis?.cancel();
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) { stopAll(); show(b.dataset.go); } });

/* ---------------- Home ---------------- */
const dayKey = (d) => d.toLocaleDateString("en-CA");
function streak() {
  const days = new Set(load().map((s) => dayKey(new Date(s.date))));
  const d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); } return n;
}
const practisedToday = () => load().some((s) => dayKey(new Date(s.date)) === dayKey(new Date()));
function streakText() { const n = streak(); return n ? `${n} day${n > 1 ? "s" : ""} in a row 🔥` : "Start your streak today"; }
function renderHome() { $("#streak").textContent = streakText(); $("#banner").hidden = practisedToday(); }

$("#level").onchange = (e) => { level = e.target.value; if (topic) $("#topicHint").textContent = HINT[level]; };
function giveTopic() { topic = nextTopic(); $("#topicCat").textContent = topic.c; $("#topicText").textContent = topic.t; $("#topicHint").textContent = HINT[level]; $("#topicCard").hidden = false; $("#getTopic").hidden = true; }
$("#getTopic").onclick = giveTopic; $("#newTopic").onclick = giveTopic;
$("#startPrep").onclick = startPrep;

/* reminder: works while the tab is open */
$("#remindBtn").onclick = async () => {
  const t = $("#remindTime").value;
  if (t && "Notification" in window && (await Notification.requestPermission()) === "granted") {
    localStorage.sd_remind = t; $("#remindNote").textContent = `Reminder set for ${t}. It works while this page is open.`;
  } else $("#remindNote").textContent = "Notifications are blocked in this browser. Allow them in the address-bar menu and try again.";
};
setInterval(() => {
  const t = localStorage.sd_remind, now = new Date(), today = dayKey(now);
  if (!t || practisedToday() || localStorage.sd_reminded === today) return;
  if (now.toTimeString().slice(0, 5) >= t && Notification.permission === "granted") {
    localStorage.sd_reminded = today; new Notification("Time for Speak Daily 🎙️", { body: "Your 2-minute practice is waiting." });
  }
}, 30000);

/* ---------------- Prep ---------------- */
function startPrep() {
  stopAll(); show("prep"); $("#prepTopic").textContent = topic.t;
  const end = Date.now() + 30000; clearInterval(timer);
  timer = setInterval(() => {
    const left = Math.ceil((end - Date.now()) / 1000); $("#prepTime").textContent = left;
    if (left <= 0) startRecording();
  }, 200);
}
$("#prepNew").onclick = () => { topic = nextTopic(); startPrep(); };
$("#skipPrep").onclick = () => startRecording();

/* ---------------- Recording ---------------- */
async function startRecording() {
  clearInterval(timer);
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) {
    const msg = { NotAllowedError: "Microphone access is blocked. Click the 🔒 icon in the address bar, set Microphone to Allow, then try again.",
      NotFoundError: "No microphone was found. Plug one in or check your device settings.",
      NotReadableError: "Another app is using your microphone. Close it and try again." }[e.name] || "We couldn't open your microphone (" + e.name + ").";
    $("#micMsg").textContent = (window.isSecureContext ? "" : "This page must be opened over https://. ") + msg; show("mic"); return;
  }
  show("record"); $("#recTopic").textContent = topic.t; cancelled = false; chunks = [];
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
  rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  const type = rec.mimeType || "audio/webm";
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => { if (!cancelled) { cache = {}; process(new Blob(chunks, { type })); } };
  rec.start(1000);
  ac = new AudioContext(); an = ac.createAnalyser(); an.fftSize = 1024; ac.createMediaStreamSource(stream).connect(an); draw();
  t0 = Date.now(); timer = setInterval(tick, 200); tick();
}
$("#micRetry").onclick = startRecording;
function tick() {
  const el = (Date.now() - t0) / 1000, b = $("#stopBtn");
  $("#recTime").textContent = fmt(120 - el);
  b.disabled = el < 20; b.textContent = el < 20 ? `Stop (in ${Math.ceil(20 - el)}s)` : "Stop";
  if (el >= 120) stopRecording();
}
function stopRecording() {
  clearInterval(timer); cancelAnimationFrame(raf); cancelled = false;
  const r = rec; stream.getTracks().forEach((t) => t.stop()); ac.close().catch(() => {}); r.stop();
}
$("#stopBtn").onclick = stopRecording;
function draw() {
  const c = $("#wave"), g = c.getContext("2d"), d = new Uint8Array(an.fftSize), col = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  (function loop() {
    an.getByteTimeDomainData(d); g.clearRect(0, 0, c.width, c.height); g.beginPath(); let peak = 0;
    d.forEach((v, i) => { peak = Math.max(peak, Math.abs(v - 128)); const y = (v / 255) * c.height; i ? g.lineTo((i / d.length) * c.width, y) : g.moveTo(0, y); });
    g.strokeStyle = col; g.lineWidth = 2; g.stroke(); $("#pulse").style.transform = `scale(${1 + peak / 100})`;
    raf = requestAnimationFrame(loop);
  })();
}

/* ---------------- Processing ---------------- */
async function api(url, opt) {
  const r = await fetch(url, opt), t = await r.text(); let j;
  try { j = JSON.parse(t); } catch { throw new Error(`The server did not answer properly (status ${r.status}). Please retry.`); }
  if (j.error) throw new Error(j.error); return j;
}
async function process(blob) {
  lastBlob = blob; show("processing");
  try {
    if (!cache.tr) {
      $("#step").textContent = "Transcribing your speech…";
      const fd = new FormData(); fd.append("audio", blob, "speech." + (blob.type.includes("mp4") ? "mp4" : "webm"));
      cache.tr = await api("/api/transcribe", { method: "POST", body: fd });
    }
    const tr = cache.tr;
    if (!tr.words || tr.words.length < 15) { cache = {}; throw new Error("I couldn't catch enough speech. Please speak a little louder and closer to the microphone, then record again."); }
    const metrics = calcMetrics(tr);
    $("#step").textContent = "Writing your feedback…";
    const report = await api("/api/feedback", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: topic.t, difficulty: level, transcript: tr.text.trim(), metrics }) });
    const s = { id: Date.now(), date: new Date().toISOString(), topic: topic.t, difficulty: level, transcript: tr.text.trim(), metrics, report };
    store([...load(), s]); await putAudio(s.id, blob); cache = {};
    renderReport(s, blob);
  } catch (e) { $("#failMsg").textContent = e.message; show("fail"); }
}
$("#retry").onclick = () => (lastBlob ? process(lastBlob) : show("home"));

function calcMetrics(tr) {
  const w = tr.words, tok = (x) => x.word.toLowerCase().replace(/[^a-z']/g, "");
  const span = Math.max(1, w[w.length - 1].end - w[0].start);
  const gaps = []; for (let i = 1; i < w.length; i++) { const g = w[i].start - w[i - 1].end; if (g > 0.7) gaps.push(g); }
  const items = {}, add = (k) => (items[k] = (items[k] || 0) + 1);
  w.forEach((x, i) => {
    const t = tok(x), next = w[i + 1] && tok(w[i + 1]);
    if (["um", "umm", "uh", "uhh", "er", "erm", "hmm", "ah"].includes(t)) add(t);
    else if (t === "like" && (/,/.test(x.word) || (i && /,/.test(w[i - 1].word)))) add("like");
    else if (t === "you" && next === "know") add("you know");
  });
  const low = (tr.segments || []).filter((s) => s.avg_logprob < -0.5).sort((a, b) => a.avg_logprob - b.avg_logprob).slice(0, 4)
    .map((s) => ({ text: s.text.trim(), avg_logprob: +s.avg_logprob.toFixed(2) }));
  return {
    total_words: w.length, speaking_span_sec: Math.round(span), words_per_minute: Math.round((w.length / span) * 60),
    long_pauses: { count: gaps.length, longest_sec: gaps.length ? +Math.max(...gaps).toFixed(1) : 0, avg_sec: gaps.length ? +(gaps.reduce((a, b) => a + b) / gaps.length).toFixed(1) : 0 },
    fillers: { count: Object.values(items).reduce((a, b) => a + b, 0), items },
    low_confidence_segments: low,
    note: "Whisper often omits fillers, so filler counts may be underestimated. Confidence is per segment, not per word.",
  };
}

/* ---------------- Report ---------------- */
function diffMark(a, b) {
  const n = a.length, m = b.length, nm = (w) => w.toLowerCase().replace(/[^\w']/g, ""), A = a.map(nm), B = b.map(nm);
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const keep = new Set(); let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { keep.add(j); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  return b.map((w, k) => (keep.has(k) ? esc(w) : `<mark>${esc(w)}</mark>`)).join(" ");
}
const section = (title, score, body) => `<div class="card"><div class="sub"><h3>${title}</h3>${score != null ? `<span class="pill">${score}/10</span>` : ""}</div>${body}</div>`;
const list = (a) => `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;

function renderReport(s, blob) {
  const r = s.report, m = s.metrics;
  const url = blob ? URL.createObjectURL(blob) : "";
  $("#report").innerHTML = `
    <div class="card" style="text-align:center"><div class="muted">${esc(s.topic)}</div>
      <div class="score">${r.overall_score}<small>/10</small></div><p class="lead">Great effort! Here's your feedback.</p>
      ${url ? `<audio controls src="${url}"></audio>` : '<p class="muted">Recording not available on this device.</p>'}
      <div class="muted">${m.total_words} words · ${m.words_per_minute} words/min · ${m.long_pauses.count} long pauses · ${m.fillers.count} fillers</div></div>
    ${section("🗣️ Fluency", r.fluency.score, `<p>${esc(r.fluency.feedback)}</p>${list(r.fluency.tips)}`)}
    ${section("🔤 Pronunciation", r.pronunciation.score, `<p>${esc(r.pronunciation.feedback)}</p>
      ${r.pronunciation.words_to_practice.map((w) => `<div class="err"><b>${esc(w.word)}</b> — ${esc(w.tip)}</div>`).join("")}
      <p class="note">Honest note: this is inferred from your transcript and speech-recognition confidence. The AI did not hear your audio.</p>`)}
    ${section("✏️ Grammar", r.grammar.score, `<p>${esc(r.grammar.feedback)}</p>
      ${r.grammar.errors.length ? r.grammar.errors.map((e) => `<div class="err"><div class="bad">❌ ${esc(e.original)}</div><div class="good">✅ ${esc(e.corrected)}</div><div>💡 ${esc(e.explanation)}</div></div>`).join("") : "<p>No mistakes found. Excellent! 🎉</p>"}`)}
    ${section("📚 Vocabulary & content", null, `<p>${esc(r.vocabulary_and_content.feedback)}</p>
      ${r.vocabulary_and_content.suggestions.map((v) => `<div class="err">Instead of <b>${esc(v.instead_of)}</b> try <b class="good">${esc(v.try)}</b><div class="muted">${esc(v.example)}</div></div>`).join("")}`)}
    ${section("✅ Corrected transcript", null, `<p>${diffMark(s.transcript.split(/\s+/), r.corrected_transcript.split(/\s+/))}</p>
      <div class="row noprint"><button class="ghost" id="speak">🔊 Listen</button></div>`)}
    ${section("⭐ Strengths", null, list(r.strengths))}
    ${section("🎯 Next steps", null, list(r.next_steps))}
    <div class="row noprint"><button id="again">Practise again</button><button class="ghost" id="pdf">Export PDF</button><button class="ghost" data-go="history">History</button></div>`;
  $("#speak").onclick = () => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(r.corrected_transcript); u.lang = "en-US"; u.rate = 0.95; speechSynthesis.speak(u); };
  $("#pdf").onclick = () => print();
  $("#again").onclick = () => { topic = null; $("#topicCard").hidden = true; $("#getTopic").hidden = false; show("home"); };
  show("report");
}

/* ---------------- History ---------------- */
function chart(list) {
  if (list.length < 2) return '<p class="muted">Complete 2 or more sessions to see your score trend.</p>';
  const W = 600, H = 190, p = 30, d = list.slice(-30), x = (i) => p + (i * (W - 2 * p)) / (d.length - 1), y = (v) => H - p - (v / 10) * (H - 2 * p);
  const pts = d.map((s, i) => [x(i), y(s.report.overall_score)]);
  return `<b>Overall score over time</b><svg viewBox="0 0 ${W} ${H}">
    ${[0, 5, 10].map((v) => `<line x1="${p}" x2="${W - p}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".15"/><text x="4" y="${y(v) + 4}" font-size="12" fill="currentColor" opacity=".6">${v}</text>`).join("")}
    <polyline points="${pts.map((q) => q.join(",")).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="3"/>
    ${pts.map((q) => `<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="var(--accent)"/>`).join("")}</svg>`;
}
function renderHistory() {
  const all = load(); $("#streak2").textContent = streakText(); $("#chart").innerHTML = chart(all);
  $("#list").innerHTML = all.length ? [...all].reverse().map((s) => `<div class="item" data-id="${s.id}"><span>${esc(s.topic)}<div class="muted">${new Date(s.date).toLocaleDateString()} · ${esc(s.difficulty)}</div></span><b>${s.report.overall_score}/10</b></div>`).join("") : '<p class="muted">No sessions yet. Your first one is waiting!</p>';
  $$("#list .item").forEach((el) => (el.onclick = async () => { const s = all.find((x) => x.id == el.dataset.id); renderReport(s, await getAudio(s.id)); }));
}

renderHome();
