require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const ordersRoute   = require('./routes/orders');
const webhooksRoute = require('./routes/webhooks');
const adminRoute    = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Webhooks need raw body for signature verification — must come BEFORE json()
app.use('/api/webhooks', require('./routes/webhooks'));

// Regular JSON parsing for all other routes
app.use(express.json());

// ─── ROUTES ─────────────────────────────────────────────────────────────────
app.use('/api/orders',  ordersRoute);
app.use('/api/admin',   adminRoute);

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// ─── ERROR HANDLER ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`
  ✦ Claude with Crypto — Backend
  ──────────────────────────────
  Listening on  http://localhost:${PORT}
  Health check  http://localhost:${PORT}/api/health
  `);
});
