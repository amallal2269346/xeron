/**
 * NOWPayments API wrapper
 * Docs: https://documenter.getpostman.com/view/7907941/2s93JqTRWN
 */
const axios = require('axios');
const crypto = require('crypto');

const BASE = 'https://api.nowpayments.io/v1';

// Map our currency keys → NOWPayments pay_currency codes
const CURRENCY_MAP = {
  usdc: 'usdcsol',   // USDC on Solana (lowest fees)
  usdt: 'usdterc20', // USDT on Ethereum
  sol:  'sol',
};

// Override per network selection
const NETWORK_CURRENCY_MAP = {
  usdc: {
    solana:   'usdcsol',
    ethereum: 'usdcerc20',
    polygon:  'usdcmatic',
  },
  usdt: {
    solana:   'usdtsol',
    ethereum: 'usdterc20',
    polygon:  'usdtmatic',
  },
  sol: {
    solana: 'sol',
  },
};

const api = axios.create({
  baseURL: BASE,
  headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY },
});

/**
 * Create a payment invoice on NOWPayments.
 * Returns { payment_id, pay_address, pay_amount, pay_currency, payment_status }
 */
async function createPayment({ orderId, usdAmount, currency, network, email }) {
  const payCurrency = (NETWORK_CURRENCY_MAP[currency] && NETWORK_CURRENCY_MAP[currency][network])
    || CURRENCY_MAP[currency]
    || 'usdcsol';

  const { data } = await api.post('/payment', {
    price_amount:      usdAmount,
    price_currency:    'usd',
    pay_currency:      payCurrency,
    order_id:          orderId,
    order_description: `Claude with Crypto — Order ${orderId}`,
    ipn_callback_url:  `${process.env.FRONTEND_URL}/api/webhooks/nowpayments`,
    is_fixed_rate:     true,   // lock exchange rate at creation
    is_fee_paid_by_user: false,
  });

  return {
    payment_id:      data.payment_id,
    pay_address:     data.pay_address,
    pay_amount:      data.pay_amount,
    pay_currency:    data.pay_currency,
    payment_status:  data.payment_status,
    expiration_estimate_date: data.expiration_estimate_date,
  };
}

/**
 * Get payment status by payment_id
 */
async function getPaymentStatus(paymentId) {
  const { data } = await api.get(`/payment/${paymentId}`);
  return data;
}

/**
 * Verify NOWPayments IPN webhook signature
 * NOWPayments sends x-nowpayments-sig header = HMAC-SHA512 of sorted JSON body
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return true; // skip in dev if not set

  // NOWPayments sorts keys alphabetically before hashing
  const sorted = JSON.stringify(
    JSON.parse(rawBody),
    Object.keys(JSON.parse(rawBody)).sort()
  );

  const expected = crypto
    .createHmac('sha512', secret)
    .update(sorted)
    .digest('hex');

  return expected === signature;
}

module.exports = { createPayment, getPaymentStatus, verifyWebhookSignature };
