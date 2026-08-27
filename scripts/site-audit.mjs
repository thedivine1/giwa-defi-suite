const BASE = "https://giwa-defi-suite.vercel.app";
const pages = ["/", "/architecture.html", "/api-quickstart.html", "/doc-score-v2.html", "/releases.html"];

async function checkPage(path) {
    const r = await fetch(BASE + path);
    const html = await r.text();
    console.log("PAGE", path, r.status);
    const refs = [...html.matchAll(/(?:href|src)=["']([^"'#?]+)/g)].map(m => m[1]);
    const internal = refs.filter(h => {
        if (h.startsWith("http")) return false;
        if (h.startsWith("mailto:")) return false;
        if (h.startsWith("//")) return false;
        if (h.startsWith("data:")) return false;
        if (h.startsWith("javascript:")) return false;
        return true;
    });
    return { path, status: r.status, html, internal };
}

async function run() {
    const results = await Promise.all(pages.map(checkPage));
    const seen = new Set();
    const broken = [];
    for (const p of results) {
        for (const ref of p.internal) {
            if (seen.has(ref)) continue;
            seen.add(ref);
            try {
                const url = BASE + (ref.startsWith("/") ? ref : "/" + ref);
                const r = await fetch(url);
                if (r.status !== 200) {
                    broken.push({ from: p.path, ref, status: r.status });
                    console.log("BROKEN:", ref, r.status);
                } else {
                    process.stdout.write(".");
                }
            } catch(e) {
                broken.push({ from: p.path, ref, status: "ERR:" + e.message });
            }
        }
    }
    console.log("");
    console.log("Total internal refs checked:", seen.size);
    if (broken.length) {
        console.log("BROKEN LINKS:", JSON.stringify(broken, null, 2));
    } else {
        console.log("All internal links OK");
    }

    const index = results.find(r => r.path === "/");
    console.log("Contact form Send Message present:", index?.html?.includes("Send Message"));
    const releases = results.find(r => r.path === "/releases.html");
    console.log("Releases status:", releases?.status);
    if (releases?.html) {
        console.log("Releases current section:", releases.html.includes("current") || releases.html.includes("Current") || releases.html.includes("Latest"));
        console.log("Releases roadmap section:", releases.html.includes("roadmap") || releases.html.includes("Roadmap"));
    }
}
run().catch(console.error);
