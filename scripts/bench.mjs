const BASE = "https://giwa-defi-suite.vercel.app";
const HOT = "0xE5EFB15259292F5B60A1DB074B708712998dB147";
const rnd = () => "0x" + [...Array(40)].map(() => "0123456789abcdef"[Math.random() * 16 | 0]).join("");
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
async function ms(f) { const t = performance.now(); const r = await f(); if (!r.ok) throw new Error("HTTP " + r.status + ": " + await r.text()); await r.json(); return performance.now() - t; }
async function bench(name, n, f) {
    const a = []; for (let i = 0; i < n; i++) { try { a.push(await ms(f)); } catch (e) { console.log(name, "ERR", e.message); } }
    if (a.length) console.log(`${name.padEnd(14)} n=${a.length} p50=${pct(a, .5) | 0}ms p95=${pct(a, .95) | 0}ms max=${Math.max(...a) | 0}ms`);
    return { p50: pct(a, .5) | 0, p95: pct(a, .95) | 0, max: Math.max(...a) | 0 };
}

// Self-provision a trial key if PROVEN_KEY is unset
let KEY = process.env.PROVEN_KEY || "";
if (!KEY) {
    console.log("PROVEN_KEY unset — minting trial key via POST /api/keys/trial ...");
    const r = await fetch(BASE + "/api/keys/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: "bench" })
    });
    const j = await r.json();
    if (!r.ok || !j.key) { console.error("Failed to mint trial key:", j); process.exit(1); }
    KEY = j.key;
    console.log("Minted:", KEY, "\n");
}

const H = { "x-proven-key": KEY };

const h  = await bench("health",       10, () => fetch(BASE + "/api/health"));
// warm up cache
await fetch(BASE + "/api/score/" + HOT, { headers: H });
const c  = await bench("score CACHED", 15, () => fetch(BASE + "/api/score/" + HOT, { headers: H }));
const co = await bench("score COLD",   10, () => fetch(BASE + "/api/score/" + rnd(), { headers: H }));

// Emit JSON summary for the HTML patch step
const today = new Date().toISOString().slice(0, 10);
console.log("\n--- BENCH SUMMARY (for HTML) ---");
console.log(JSON.stringify({ date: today, health: h, cached: c, cold: co }));