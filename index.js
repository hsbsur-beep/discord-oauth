const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();

mongoose.connect(process.env.MONGODB_URI);

const VerifiedMember = mongoose.model('VerifiedMember', new mongoose.Schema({
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

    await axios.put(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${user.id}`,
      { access_token },
      { headers: { Authorization: `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' } }
    ).catch(() => {});

    res.send('<html><body style="background:#2c2f33;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>✅ تم التحقق بنجاح!</h2><p>يمكنك إغلاق هذه الصفحة.</p></div></body></html>');
  } catch (err) {
    res.send('❌ خطأ: ' + err.message);
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Ready'));
