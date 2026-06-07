const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();

// اتصال MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ MongoDB connected'))
        .catch(err => console.log('❌ MongoDB error:', err.message));
}

// نموذج المستخدم
const UserSchema = new mongoose.Schema({
    userId: String,
    username: String,
    verifiedAt: { type: Date, default: Date.now }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('No code provided');

    try {
        // 1. جلب التوكن
        const token = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.REDIRECT_URI,
            }));

        // 2. جلب المستخدم
        const user = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${token.data.access_token}` }
        });

        // 3. حفظ في MongoDB
        if (MONGODB_URI) {
            await User.findOneAndUpdate(
                { userId: user.data.id },
                { userId: user.data.id, username: user.data.username },
                { upsert: true }
            );
        }

        res.send(`
            <html>
            <body style="background:#1e1f22; color:white; text-align:center; padding:50px; font-family:Arial;">
                <h2>✅ تم التحقق بنجاح!</h2>
                <p>مرحباً ${user.data.username}</p>
                <p>تم حفظ بياناتك.</p>
                <script>setTimeout(()=>window.close(),2000);</script>
            </body>
            </html>
        `);
    } catch (err) {
        res.send(`<h2>❌ خطأ: ${err.message}</h2>`);
    }
});

app.listen(process.env.PORT || 3000, () => console.log('✅ Server running'));
