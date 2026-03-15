# Claude with Crypto — Backend

## Stack
- **Express** — HTTP server
- **better-sqlite3** — Order database (zero config, single file)
- **NOWPayments** — Crypto payment detection + webhooks
- **Nodemailer** — Email delivery (Gmail)

## How the full flow works

```
1. Customer fills form → clicks "Continue to Payment"
2. Frontend calls POST /api/orders → backend creates NOWPayments invoice
3. NOWPayments returns a deposit address + exact crypto amount
4. Customer sends crypto to that address
5. NOWPayments detects on-chain payment → fires webhook to backend
6. Backend marks order as "paid" → emails customer "payment received"
7. Backend emails YOU (admin) → "new order, go buy the subscription"
8. You buy Claude subscription on claude.ai manually
9. You call POST /api/admin/fulfill with the credentials
10. Backend emails customer their subscription details
```

## Setup

### 1. Get a NOWPayments account
- Sign up at https://nowpayments.io
- Go to **Store Settings** → get your **API Key**
- Go to **Store Settings → IPN** → set your IPN Secret Key

### 2. Set up Gmail App Password
- Enable 2FA on your Google account
- Go to https://myaccount.google.com/apppasswords
- Generate an app password for "Mail"

### 3. Deploy backend (Railway — free tier)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
cd backend/
railway init
railway up
```
Copy the Railway URL (e.g. `https://your-app.railway.app`)

### 4. Configure environment variables
```bash
# On Railway dashboard → Variables, add:
PORT=3001
FRONTEND_URL=https://your-site.vercel.app
NOWPAYMENTS_API_KEY=xxx
NOWPAYMENTS_IPN_SECRET=xxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=Claude with Crypto <you@gmail.com>
ADMIN_SECRET=some_random_secret_string
```

### 5. Set webhook URL in NOWPayments
- Dashboard → Store Settings → IPN Callback URL:
  `https://your-backend.railway.app/api/webhooks/nowpayments`

### 6. Update frontend backend URL
In `claude-with-crypto/app.js`, line 1:
```js
const API = 'https://your-backend.railway.app';
```

### 7. Update vercel.json rewrite
In `vercel.json`:
```json
"rewrites": [
  { "source": "/api/(.*)", "destination": "https://your-backend.railway.app/api/$1" }
]
```

## Admin API

All admin routes require: `Authorization: Bearer YOUR_ADMIN_SECRET`

### List all orders
```
GET /api/admin/orders
GET /api/admin/orders?status=paid
```

### Fulfill an order (after buying the subscription)
```
POST /api/admin/fulfill
{
  "orderId": "uuid-here",
  "deliveryNote": "Email: shared@example.com\nPassword: Abc123!\nExpires: 2026-03-01"
}
```

### Resend delivery email
```
POST /api/admin/resend
{ "orderId": "uuid-here" }
```

## Local development
```bash
cd backend/
cp .env.example .env
# Fill in .env values
npm install
npm run dev
```

Backend runs on http://localhost:3001
