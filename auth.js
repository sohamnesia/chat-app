const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const JWT_EXPIRES = '7d';

// In-memory stores (swap for DB in production)
// accounts: email -> { name, passwordHash, color, verified, createdAt }
const accounts = {};
// otps: email -> { code, expiresAt, type: 'verify'|'reset' }
const otps = {};

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];
let colorIdx = 0;

// Brevo email sender
async function sendOtpEmail(toEmail, code, type) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) throw new Error('BREVO_SENDER_EMAIL is not set');
  const senderName = process.env.BREVO_SENDER_NAME || 'Chat App';
  const isVerify = type === 'verify';
  const subject = isVerify ? 'Verify your Chat account' : 'Reset your Chat password';
  const action = isVerify ? 'verify your email address' : 'reset your password';

  const payload = JSON.stringify({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail }],
    subject,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1117;color:#e8eaf0;border-radius:16px;padding:40px 36px;">
        <h2 style="margin:0 0 8px;font-size:22px;">Chat App</h2>
        <p style="color:#7a7f96;margin:0 0 32px;font-size:14px;">Your one-time code to ${action}</p>
        <div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
          <span style="font-size:40px;font-weight:700;letter-spacing:14px;color:#5b6ef5;">${code}</span>
        </div>
        <p style="color:#7a7f96;font-size:13px;margin:0;">This code expires in <strong style="color:#e8eaf0;">10 minutes</strong>. Don't share it with anyone.</p>
      </div>
    `,
  });

  const response = await new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body: data });
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Brevo send failed (${response.statusCode}): ${response.body}`);
  }
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeOtp(email, code, type) {
  otps[email] = { code, type, expiresAt: Date.now() + 10 * 60 * 1000 };
}

function verifyOtp(email, code, type) {
  const otp = otps[email];
  if (!otp) return { ok: false, msg: 'No OTP found. Request a new one.' };
  if (otp.type !== type) return { ok: false, msg: 'Wrong OTP type.' };
  if (Date.now() > otp.expiresAt) {
    delete otps[email];
    return { ok: false, msg: 'OTP expired. Request a new one.' };
  }
  if (otp.code !== code.trim()) return { ok: false, msg: 'Incorrect OTP.' };
  delete otps[email];
  return { ok: true };
}

function signToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function mountAuthRoutes(app) {
  const express = require('express');
  app.use(express.json());

  app.post('/auth/register', async (req, res) => {
    const { email, name, password } = req.body || {};
    if (!email || !name || !password) {
      return res.json({ ok: false, msg: 'Email, name and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json({ ok: false, msg: 'Invalid email address.' });
    }
    if (name.trim().length < 2) {
      return res.json({ ok: false, msg: 'Name must be at least 2 characters.' });
    }
    if (password.length < 6) {
      return res.json({ ok: false, msg: 'Password must be at least 6 characters.' });
    }

    const key = email.toLowerCase();
    if (accounts[key] && accounts[key].verified) {
      return res.json({ ok: false, msg: 'Email already registered. Please log in.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    accounts[key] = {
      name: name.trim().slice(0, 24),
      passwordHash,
      color: COLORS[colorIdx++ % COLORS.length],
      verified: false,
      createdAt: Date.now(),
    };

    const code = generateOtp();
    storeOtp(key, code, 'verify');

    try {
      await sendOtpEmail(key, code, 'verify');
    } catch (e) {
      console.error('Email send failed:', e.message);
      return res.json({ ok: false, msg: `Failed to send OTP email: ${e.message}` });
    }

    return res.json({ ok: true, msg: 'OTP sent to your email.' });
  });

  app.post('/auth/verify-otp', (req, res) => {
    const { email, code } = req.body || {};
    const key = email?.toLowerCase();
    if (!key || !code) return res.json({ ok: false, msg: 'Missing email or code.' });
    if (!accounts[key]) return res.json({ ok: false, msg: 'Account not found.' });

    const check = verifyOtp(key, code, 'verify');
    if (!check.ok) return res.json(check);

    accounts[key].verified = true;
    const token = signToken(key);
    return res.json({ ok: true, token, name: accounts[key].name, color: accounts[key].color });
  });

  app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const key = email?.toLowerCase();
    if (!key || !password) return res.json({ ok: false, msg: 'Email and password required.' });

    const acc = accounts[key];
    if (!acc) return res.json({ ok: false, msg: 'No account found for this email.' });
    if (!acc.verified) return res.json({ ok: false, msg: 'Email not verified. Check your inbox.' });

    const match = await bcrypt.compare(password, acc.passwordHash);
    if (!match) return res.json({ ok: false, msg: 'Incorrect password.' });

    const token = signToken(key);
    return res.json({ ok: true, token, name: acc.name, color: acc.color });
  });

  app.post('/auth/forgot', async (req, res) => {
    const key = req.body?.email?.toLowerCase();
    if (!key) return res.json({ ok: false, msg: 'Email required.' });
    const acc = accounts[key];
    if (!acc || !acc.verified) {
      return res.json({ ok: true, msg: 'If that email exists, a reset code was sent.' });
    }

    const code = generateOtp();
    storeOtp(key, code, 'reset');
    try {
      await sendOtpEmail(key, code, 'reset');
    } catch (e) {
      console.error('Email error:', e.message);
    }

    return res.json({ ok: true, msg: 'If that email exists, a reset code was sent.' });
  });

  app.post('/auth/reset', async (req, res) => {
    const { email, code, newPassword } = req.body || {};
    const key = email?.toLowerCase();
    if (!key || !code || !newPassword) return res.json({ ok: false, msg: 'Missing fields.' });
    if (newPassword.length < 6) return res.json({ ok: false, msg: 'Password must be at least 6 characters.' });

    const check = verifyOtp(key, code, 'reset');
    if (!check.ok) return res.json(check);

    accounts[key].passwordHash = await bcrypt.hash(newPassword, 10);
    return res.json({ ok: true, msg: 'Password reset! You can now log in.' });
  });

  app.post('/auth/resend', async (req, res) => {
    const key = req.body?.email?.toLowerCase();
    if (!key || !accounts[key]) return res.json({ ok: false, msg: 'Account not found.' });
    if (accounts[key].verified) return res.json({ ok: false, msg: 'Already verified.' });

    const code = generateOtp();
    storeOtp(key, code, 'verify');
    try {
      await sendOtpEmail(key, code, 'verify');
    } catch (e) {
      console.error('Resend error:', e.message);
      return res.json({ ok: false, msg: `Failed to send email: ${e.message}` });
    }
    return res.json({ ok: true, msg: 'New OTP sent.' });
  });
}

module.exports = { mountAuthRoutes, verifyToken, accounts };
