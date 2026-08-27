const { kvGet } = require('../utils');
module.exports = async function handler(req, res) {
    const record = await kvGet('key:' + req.query.token);
    res.json({ record });
}
