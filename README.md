# 💬 Real-time Chat App — with Email Auth + OTP

## Features
- ✅ Email + Password registration
- ✅ OTP email verification (6-digit code via Gmail)
- ✅ Secure login with JWT sessions (7-day)
- ✅ Forgot password → OTP reset flow
- ✅ Passwords hashed with bcrypt
- ✅ Auto-login from stored token
- ✅ Live messaging, typing indicator, online users
- ✅ Sign out button

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env`:
```
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
JWT_SECRET=any_long_random_string
PORT=3000
```

**How to get a Gmail App Password (free):**
1. Enable 2-Step Verification on your Google Account
2. Go to: myaccount.google.com → Security → App Passwords
3. Select app: "Mail", device: "Other" → Generate
4. Copy the 16-character password into .env

### 3. Start the server
```bash
npm start
# or for dev with auto-reload:
npm run dev
```

### 4. Open in browser
```
http://localhost:3000
```

---

## Auth Flow
```
Register (name + email + password)
  → OTP sent to email
  → Enter 6-digit code
  → Verified ✓ → Enter chat (JWT issued)

Login (email + password)
  → JWT issued → Enter chat

Forgot password
  → Enter email → OTP sent
  → Enter code + new password → Reset ✓
```

---

## Project Structure
```
chat-app/
├── server.js       # Express + Socket.io server
├── auth.js         # Auth routes, OTP logic, JWT, nodemailer
├── package.json
├── .env.example    # Copy to .env and fill in
└── public/
    └── index.html  # Full client (all auth screens + chat UI)
```

---

## Production Tips
- Swap in-memory `accounts` for a real database (MongoDB, PostgreSQL, SQLite)
- Use `HTTPS` (required for secure cookies in production)
- Deploy on Railway, Render, or Fly.io (all have free tiers)
