const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();

// اتصال MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB error:', err.message));

// نموذج المستخدم المتوثق
const VerifiedMember = mongoose.model('VerifiedMember', new mongoose.Schema({
  userId:       { type: String, required: true, unique: true },
  username:     String,
  accessToken:  String,
  refreshToken: String,
  tokenExpiry:  Date,
  verifiedAt:   { type: Date, default: Date.now },
  active:       { type: Boolean, default: true },
}));

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code provided');

  try {
    // 1. الحصول على التوكن من Discord
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

    // 2. جلب بيانات المستخدم
    const userRes = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const user = userRes.data;

    // 3. حفظ في MongoDB
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

    // 4. إضافة المستخدم إلى السيرفر
    await axios.put(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${user.id}`,
      { access_token },
      { headers: { Authorization: `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>تم التحقق</title></head>
      <body style="background:#1e1f22; color:white; text-align:center; padding:50px; font-family:Arial;">
        <h2>✅ تم التحقق بنجاح!</h2>
        <p>تم حفظ بياناتك وقبولك في السيرفر.</p>
        <p>يمكنك إغلاق هذه النافذة.</p>
        <script>setTimeout(()=>window.close(),3000);</script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.send(\`<h2>❌ حدث خطأ</h2><p>\${err.message}</p>\`);
  }
});

app.listen(process.env.PORT || 3000, () => console.log('✅ Server ready'));
