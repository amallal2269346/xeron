const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const { createPayment } = require('../services/payments');
const { sendPaymentReceived } = require('../services/email');

const router = express.Router();

// Pricing table (USD)
const PRICES = {
  pro:   { 1: 130,  3: 360,  6: 670,   12: 1260 },
  max5:  { 1: 200,  3: 560,  6: 1050,  12: 1960 },
  max20: { 1: 250,  3: 705,  6: 1380,  12: 2580 },
};

const VALID_PLANS     = ['pro', 'max5', 'max20'];
const VALID_MONTHS    = [1, 3, 6, 12];
const VALID_CURRENCIES = ['usdc', 'usdt', 'sol'];
const VALID_NETWORKS  = ['solana', 'ethereum', 'polygon'];

// ─── POST /api/orders ───────────────────────────────────────────────────────
// Create a new order → get payment address from NOWPayments
router.post('/', async (req, res) => {
  try {
    const { email, plan, months, currency, network } = req.body;

    // Validate
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Invalid email address' });
    if (!VALID_PLANS.includes(plan))
      return res.status(400).json({ error: 'Invalid plan' });
    if (!VALID_MONTHS.includes(Number(months)))
      return res.status(400).json({ error: 'Invalid duration' });
    if (!VALID_CURRENCIES.includes(currency))
      return res.status(400).json({ error: 'Invalid currency' });
    if (!VALID_NETWORKS.includes(network))
      return res.status(400).json({ error: 'Invalid network' });

    const usdAmount = PRICES[plan][Number(months)];
    const orderId = uuidv4();

    // Create order in DB first (status = pending)
    db.createOrder({
      id: orderId,
      email,
      plan,
      months: Number(months),
      currency,
      usd_amount: usdAmount,
      crypto_amount: '0',       // updated after NOWPayments responds
      crypto_currency: currency,
      created_at: Date.now(),
    });

    // Create payment on NOWPayments
    const payment = await createPayment({
      orderId,
      usdAmount,
      currency,
      network,
      email,
    });

    // Save payment details to DB
    db.setPayment({
      id: orderId,
      payment_id: String(payment.payment_id),
      payment_address: payment.pay_address,
    });

    // Update crypto amount now that we know the exact amount
    const order = db.getById(orderId);

    return res.json({
      orderId,
      paymentId:   payment.payment_id,
      payAddress:  payment.pay_address,
      payAmount:   payment.pay_amount,
      payCurrency: payment.pay_currency,
      usdAmount,
      expiresAt:   payment.expiration_estimate_date,
    });

  } catch (err) {
    console.error('Order creation error:', err.response?.data || err.message);
    return res.status(502).json({ error: 'Payment provider error. Please try again.' });
  }
});

// ─── GET /api/orders/:id ────────────────────────────────────────────────────
// Poll order status from frontend
router.get('/:id', (req, res) => {
  const order = db.getById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Don't expose internal details to frontend
  return res.json({
    orderId:    order.id,
    status:     order.status,
    plan:       order.plan,
    months:     order.months,
    paidAt:     order.paid_at,
    fulfilledAt: order.fulfilled_at,
  });
});

module.exports = router;
