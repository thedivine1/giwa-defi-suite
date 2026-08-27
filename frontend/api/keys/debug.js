module.exports = function handler(req, res) {
    res.json({ keys: Object.keys(process.env).filter(k => k.includes('UPSTASH') || k.includes('PROVEN')) });
}
