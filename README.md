# Real-time Chat App (OTP Auth + Profiles + Admin Panel)

A real-time chat app with:
- Email/password auth
- OTP verification and password reset via Brevo
- JWT sessions
- Custom profile picture support
- Editable username from UI
- Admin panel for account management

## Features
- Register with email, name, and password
- 6-digit OTP verification on signup
- Login with JWT session (stored client-side)
- Forgot password -> OTP reset flow
- Live chat with typing indicator and online users
- Custom profile avatar:
  - Image URL
  - Local image upload (stored as data URL)
- Editable display name from profile modal
- Admin panel:
  - View all accounts
  - Edit name/avatar
  - Toggle verified/admin flags
  - Delete user accounts (except yourself)

## Tech Stack
- Node.js + Express
- Socket.IO
- bcryptjs + jsonwebtoken
- Brevo SMTP API for OTP emails
- Single-file frontend in `public/index.html`

## Project Structure
```text
chat-app/
|-- server.js
|-- auth.js
|-- package.json
|-- public/
|   `-- index.html
`-- README.md
```

## Local Setup
### 1. Install dependencies
```bash
npm install
```

### 2. Create environment variables
Create a `.env` file in project root:

```env
PORT=3000
JWT_SECRET=replace_with_a_long_random_secret

BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=verified_sender@yourdomain.com
BREVO_SENDER_NAME=Chat App

ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

Notes:
- `BREVO_SENDER_EMAIL` must be a sender configured/verified in Brevo.
- `ADMIN_EMAILS` is a comma-separated list of emails that get admin access.

### 3. Start app
```bash
npm start
```

For development:
```bash
npm run dev
```

### 4. Open app
`http://localhost:3000`

## Auth and Profile Flow
1. Register -> OTP email sent via Brevo
2. Verify OTP -> JWT issued
3. Login -> JWT issued
4. Open Profile -> update display name and avatar
5. Changes reflect in chat UI and online user list

## Admin Panel
Admin button appears for users whose email is in `ADMIN_EMAILS`.

Capabilities:
- List all accounts
- Edit name/avatar
- Toggle `verified` and `admin` flags
- Delete accounts

Security model:
- Admin routes require JWT auth + `isAdmin` account flag.

## Hosting Guide
This app works well on Railway or Render as a Node web service.

### Option A: Railway
1. Push repo to GitHub.
2. Create a new Railway project from the repo.
3. Add environment variables:
   - `PORT` (Railway often injects this automatically)
   - `JWT_SECRET`
   - `BREVO_API_KEY`
   - `BREVO_SENDER_EMAIL`
   - `BREVO_SENDER_NAME`
   - `ADMIN_EMAILS`
4. Start command:
   - `npm start`
5. Deploy and open generated Railway URL.

### Option B: Render
1. Push repo to GitHub.
2. Create a new Web Service on Render from the repo.
3. Configure:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add env vars:
   - `JWT_SECRET`
   - `BREVO_API_KEY`
   - `BREVO_SENDER_EMAIL`
   - `BREVO_SENDER_NAME`
   - `ADMIN_EMAILS`
5. Deploy and open service URL.

## Production Notes
- Current app stores users/messages in memory.
  - Restarting the server clears accounts, OTPs, and chat history.
  - For production, move to a database (PostgreSQL/MongoDB/etc).
- Use a strong `JWT_SECRET`.
- Keep Brevo API key private.
- Consider avatar size limits and CDN/object storage if you move beyond in-memory storage.

## Troubleshooting OTP
If OTP emails fail:
- Confirm `BREVO_API_KEY` is valid.
- Confirm `BREVO_SENDER_EMAIL` is verified in Brevo.
- Check API error message returned by `/auth/register` or `/auth/resend`.
