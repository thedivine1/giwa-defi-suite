const { kvBase } = require('../utils');
module.exports = async function handler(req, res) {
    const { url, tok } = kvBase();
    const k = 'test-key-1';
    const v = { hello: 'world' };
    const r = await fetch(${url}/set/, {
        method: 'POST',
        headers: { Authorization: Bearer  },
        body: JSON.stringify(v)
    });
    const status = r.status;
    const text = await r.text();
    res.json({ status, text, url: url.substring(0, 15) + '...' });
}
