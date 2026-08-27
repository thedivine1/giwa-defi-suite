const BASE = "https://giwa-defi-suite.vercel.app";
const H = { "x-proven-key": process.env.PROVEN_KEY || "" };
const HOT = "0xE5EFB15259292F5B60A1DB074B708712998dB147";
const rnd = () => "0x" + [...Array(40)].map(() => "0123456789abcdef"[Math.random() * 16 | 0]).join("");
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
async function ms(f) { const t = performance.now(); const r = await f(); if (!r.ok) throw new Error("HTTP " + r.status); await r.json(); return performance.now() - t; }
async function bench(name, n, f) {
    const a = []; for (let i = 0; i < n; i++) { try { a.push(await ms(f)); } catch (e) { console.log(name, "ERR", e.message); } }
    if (a.length) console.log(`${name.padEnd(14)} n=${a.length} p50=${pct(a, .5) | 0}ms p95=${pct(a, .95) | 0}ms max=${Math.max(...a) | 0}ms`);
}
await bench("health", 10, () => fetch(BASE + "/api/health"));
await fetch(BASE + "/api/score/" + HOT, { headers: H });
await bench("score CACHED", 15, () => fetch(BASE + "/api/score/" + HOT, { headers: H }));
await bench("score COLD", 10, () => fetch(BASE + "/api/score/" + rnd(), { headers: H }));