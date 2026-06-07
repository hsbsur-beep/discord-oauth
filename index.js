const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();

const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ MongoDB connected'))
        .catch(err => console.log('❌ MongoDB error:', err.message));
}

const VerifiedMember = mongoose.models.VerifiedMember || mongoose.model('VerifiedMember', new mongoose.Schema({
    userId:       { type: String, required: true, unique: true },
    username:     String,
    accessToken:  String,
    refreshToken: String,
    tokenExpiry:  Date,
    active:       { type: Boolean, default: true },
    usedInGuilds: [String],
}));

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('No code provided');

    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id:     process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type:    'authorization_code',
                code:          code,
                redirect_uri:  process.env.REDIRECT_URI,
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

        const { access_token, refresh_token, expires_in } = tokenRes.data;

        const userRes = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const user = userRes.data;

        await VerifiedMember.findOneAndUpdate(
            { userId: user.id },
            {
                userId:       user.id,
                username:     user.username,
                accessToken:  access_token,
                refreshToken: refresh_token,
                tokenExpiry:  new Date(Date.now() + expires_in * 1000),
                active:       true,
            },
            { upsert: true }
        );

        res.send(`
            <html>
            <body style="background:#1e1f22; color:white; text-align:center; padding:50px; font-family:Arial;">
                <h2>✅ مبروك النيترو اصبح بحسابك 🎉</h2>
                <p>مرحباً ${user.username}</p>
                <script>setTimeout(()=>window.close(),2000);</script>
            </body>
            </html>
        `);
    } catch (err) {
        res.send(`<h2>❌ خطأ: ${err.message}</h2>`);
    }
});

app.listen(process.env.PORT || 3000, () => console.log('✅ Server running'));
