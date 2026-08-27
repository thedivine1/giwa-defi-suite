const { kvBase, kvGet } = require('../utils');
module.exports = async function handler(req, res) {
    const { url, tok } = kvBase();
    
    // Test direct kvGet
    const getRes = await kvGet('key:test_debug_key');
    
    // Test direct set
    let setStatus, setText;
    try {
        const r = await fetch(${url}/set/key%3Atest_debug_key?EX=3600, {
            method: 'POST',
            headers: { Authorization: Bearer  },
            body: JSON.stringify({ hello: 'world' })
        });
        setStatus = r.status;
        setText = await r.text();
    } catch(e) {
        setText = e.message;
    }
    
    res.json({ url, getRes, setStatus, setText });
}
