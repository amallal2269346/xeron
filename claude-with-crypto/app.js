/* ─── CONFIG ─────────────────────────────────────────────────────────────────
   Point this to your backend. In production set it to your Railway/Render URL.
   In local dev, run the backend on :3001 and set:  const API = 'http://localhost:3001'
─────────────────────────────────────────────────────────────────────────────── */
const API = window.BACKEND_URL || 'http://localhost:3001';

/* ─── PRICING ($USD) ─────────────────────────────────────────────────────────── */
const PRICES = {
  pro:   { 1: 130,  3: 360,  6: 670,   12: 1260 },
  max5:  { 1: 200,  3: 560,  6: 1050,  12: 1960 },
  max20: { 1: 250,  3: 705,  6: 1380,  12: 2580 },
};

const SOL_PRICE_USD    = 155;
const PLAN_LABELS      = { pro: 'Pro', max5: 'Max 5x', max20: 'Max 20x' };
const CURRENCY_LABELS  = { usdc: 'USDC', usdt: 'USDT', sol: 'SOL' };

const state = { plan: 'max5', months: 6, currency: 'usdc', network: 'solana' };
let timer = null;
let pollInterval = null;
let currentOrderId = null;

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */
function usdPrice()     { return PRICES[state.plan][state.months]; }
function fmtUsd(n)      { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function cryptoAmount() {
  const usd = usdPrice();
  if (state.currency === 'sol') return (usd / SOL_PRICE_USD).toFixed(3);
  return usd.toFixed(2);
}

/* ─── RENDER SUMMARY ─────────────────────────────────────────────────────────── */
function renderSummary() {
  const sym = CURRENCY_LABELS[state.currency];
  const months = state.months === 1 ? '1 month' : `${state.months} months`;
  document.getElementById('sumPlan').textContent     = PLAN_LABELS[state.plan];
  document.getElementById('sumDuration').textContent = months;
  document.getElementById('sumCurrency').textContent = sym;
  document.getElementById('sumTotal').textContent    = fmtUsd(usdPrice());
  document.getElementById('sumCrypto').textContent   = `${cryptoAmount()} ${sym}`;
}

/* ─── PLAN CARDS ─────────────────────────────────────────────────────────────── */
document.querySelectorAll('.plan-card').forEach(btn => {
  btn.addEventListener('click', () => {
    state.plan = btn.dataset.plan;
    document.querySelectorAll('.plan-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSummary();
  });
});
document.querySelector('.plan-card[data-plan="max5"]').classList.add('active');

/* ─── DURATION ─────────────────────────────────────────────────────────────── */
document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.months = parseInt(btn.dataset.months, 10);
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSummary();
  });
});

/* ─── CURRENCY ─────────────────────────────────────────────────────────────── */
document.querySelectorAll('.cur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.currency = btn.dataset.currency;
    document.querySelectorAll('.cur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (state.currency === 'sol') setNetwork('solana');
    else setNetwork('ethereum');
    renderSummary();
  });
});

/* ─── FAQ ─────────────────────────────────────────────────────────────────── */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const open = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!open) item.classList.add('open');
  });
});

/* ─── MODAL ─────────────────────────────────────────────────────────────────── */
const overlay    = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');

document.getElementById('checkoutBtn').addEventListener('click', handleCheckout);
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

async function handleCheckout() {
  const email = document.getElementById('emailInput').value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const inp = document.getElementById('emailInput');
    inp.focus();
    inp.style.borderColor = '#f87171';
    inp.style.boxShadow = '0 0 0 3px rgba(248,113,113,0.18)';
    setTimeout(() => { inp.style.borderColor = ''; inp.style.boxShadow = ''; }, 2200);
    return;
  }

  // Show loading state on button
  const btn = document.getElementById('checkoutBtn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="opacity:0.7">Creating order…</span>';

  try {
    const res = await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        plan:     state.plan,
        months:   state.months,
        currency: state.currency,
        network:  state.network,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Something went wrong. Please try again.');
      return;
    }

    // Store order ID for polling
    currentOrderId = data.orderId;

    // Populate modal
    document.getElementById('modalAmount').textContent = `${data.payAmount} ${data.payCurrency.toUpperCase()}`;
    document.getElementById('depositAddr').textContent = data.payAddress;
    buildQR(data.payAddress);
    setNetwork(state.network);

    // Reset tracker
    ['ts1','ts2','ts3'].forEach((id, i) => {
      document.getElementById(id).classList.toggle('active', i === 0);
    });

    // Start countdown to expiry
    if (data.expiresAt) {
      const secs = Math.floor((new Date(data.expiresAt) - Date.now()) / 1000);
      startCountdown(Math.max(secs, 0));
    } else {
      startCountdown(30 * 60);
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Poll order status
    startPolling(data.orderId);

  } catch (err) {
    console.error(err);
    showError('Could not connect to server. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (timer) { clearInterval(timer); timer = null; }
  stopPolling();
}

function showError(msg) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#f87171;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ─── ORDER POLLING ─────────────────────────────────────────────────────────── */
function startPolling(orderId) {
  stopPolling();
  pollInterval = setInterval(() => pollOrder(orderId), 8000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

async function pollOrder(orderId) {
  try {
    const res  = await fetch(`${API}/api/orders/${orderId}`);
    const data = await res.json();

    switch (data.status) {
      case 'awaiting':
        setTrackerStep(1);
        break;
      case 'confirming':
        setTrackerStep(2);
        break;
      case 'paid':
        setTrackerStep(2);
        break;
      case 'fulfilled':
        setTrackerStep(3);
        stopPolling();
        setTimeout(() => showDeliverySuccess(), 1000);
        break;
      case 'expired':
      case 'failed':
        stopPolling();
        showError('Payment expired or failed. Please start a new order.');
        break;
    }
  } catch (e) {
    // ignore network errors during polling
  }
}

function setTrackerStep(step) {
  // step 1 = awaiting, 2 = confirming, 3 = fulfilled
  document.getElementById('ts1').classList.toggle('active', step >= 1);
  document.getElementById('ts2').classList.toggle('active', step >= 2);
  document.getElementById('ts3').classList.toggle('active', step >= 3);
}

function showDeliverySuccess() {
  const top = document.querySelector('.modal-top');
  top.innerHTML = `
    <div class="modal-icon-wrap">🎉</div>
    <h2>Subscription Delivered!</h2>
    <p class="modal-subtitle" style="color:#22c55e;">Check your email inbox for access details.</p>
  `;
}

/* ─── NETWORK TABS ─────────────────────────────────────────────────────────── */
document.querySelectorAll('.net-tab').forEach(btn => {
  btn.addEventListener('click', () => setNetwork(btn.dataset.net));
});

function setNetwork(net) {
  state.network = net;
  document.querySelectorAll('.net-tab').forEach(b => b.classList.toggle('active', b.dataset.net === net));
}

/* ─── QR CODE ─────────────────────────────────────────────────────────────── */
function buildQR(text) {
  const container = document.getElementById('qrCanvas');
  container.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text, width: 140, height: 140,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }
}

/* ─── COPY ADDRESS ─────────────────────────────────────────────────────────── */
document.getElementById('copyBtn').addEventListener('click', () => {
  const addr = document.getElementById('depositAddr').textContent;
  const btn  = document.getElementById('copyBtn');
  const copy = (text) => {
    btn.textContent = '✓ Copied';
    btn.style.background = '#22c55e';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = ''; }, 2200);
  };
  navigator.clipboard
    ? navigator.clipboard.writeText(addr).then(copy).catch(() => legacyCopy(addr, copy))
    : legacyCopy(addr, copy);
});

function legacyCopy(text, cb) {
  const ta = Object.assign(document.createElement('textarea'), { value: text });
  Object.assign(ta.style, { position: 'fixed', opacity: '0' });
  document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
  cb();
}

/* ─── COUNTDOWN ─────────────────────────────────────────────────────────────── */
function startCountdown(secs) {
  if (timer) clearInterval(timer);
  let remaining = secs;
  const el = document.getElementById('countdown');
  const tick = () => {
    if (remaining < 0) {
      clearInterval(timer);
      el.textContent = 'Expired';
      el.style.color = '#f87171';
      return;
    }
    const m = Math.floor(remaining / 60), s = remaining % 60;
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    remaining--;
  };
  tick();
  timer = setInterval(tick, 1000);
}

/* ─── INIT ─────────────────────────────────────────────────────────────────── */
renderSummary();
