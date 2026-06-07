const express = require('express');
const axios = require('axios');
const app = express();

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('No code provided');

    try {
        await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: '1506426085884301404',
                client_secret: 'Cqs--mQUfAeP8yXU3MoR48i3fmlgr9KQ',
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'https://' + req.get('host') + '/callback'
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
        res.send('<h1>✅ تم التحقق بنجاح!</h1><script>setTimeout(()=>window.close(),2000);</script>');
    } catch (err) {
        res.send('<h1>❌ خطأ: ' + err.message + '</h1>');
    }
});

app.listen(3000, () => console.log('Ready'));
