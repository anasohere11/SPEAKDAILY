// Sends whitespace every 2s while `work()` runs, then the JSON result.
// Leading whitespace is valid JSON, and the open stream keeps slow AI calls from timing out.
export function streamJson(work) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      c.enqueue(enc.encode(" "));
      const t = setInterval(() => c.enqueue(enc.encode(" ")), 2000);
      let out;
      try { out = await work(); } catch (e) { out = { error: e.message || String(e) }; }
      clearInterval(t);
      c.enqueue(enc.encode(JSON.stringify(out)));
      c.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
