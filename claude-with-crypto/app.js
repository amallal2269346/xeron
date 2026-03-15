/* ─── PRICING DATA ─────────────────────────────────────────────────────────── */
const PRICES = {
  pro:   { 1: 130,  3: 360,  6: 670,  12: 1260 },
  max5:  { 1: 200,  3: 560,  6: 1050, 12: 1960 },
  max20: { 1: 250,  3: 705,  6: 1380, 12: 2580 },
};

// Approximate crypto rates (would be live in production)
const RATES = { usdc: 1, usdt: 1, sol: 0.00645 };

const PLAN_NAMES = { pro: 'Pro', max5: 'Max 5x', max20: 'Max 20x' };
const CURRENCY_NAMES = { usdc: 'USDC', usdt: 'USDT', sol: 'SOL' };

// Demo deposit addresses per network
const ADDRESSES = {
  solana:   'BvW7GQ3XHjXz8YrxC9tMk2nJpLqFzKdW5sRbUePoT4ah',
  ethereum: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  polygon:  '0x3A5C2E9b4F1D7e8B06c3D9A2f5E4C1B8d7A6e9F2',
};

/* ─── STATE ─────────────────────────────────────────────────────────────────── */
let state = {
  plan: 'max5',
  months: 6,
  currency: 'usdc',
  network: 'solana',
};

/* ─── HELPERS ───────────────────────────────────────────────────────────────── */
function getUsdPrice() {
  return PRICES[state.plan][state.months];
}

function getCryptoAmount() {
  const usd = getUsdPrice();
  const rate = RATES[state.currency];
  if (state.currency === 'sol') {
    const solPrice = 1 / rate; // ~$155
    return (usd / solPrice).toFixed(3);
  }
  return usd.toFixed(2);
}

function formatUsd(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── UPDATE UI ─────────────────────────────────────────────────────────────── */
function updateSummary() {
  const usd = getUsdPrice();
  const crypto = getCryptoAmount();
  const symbol = CURRENCY_NAMES[state.currency];
  const monthLabel = state.months === 1 ? '1 month' : `${state.months} months`;

  document.getElementById('sumPlan').textContent = PLAN_NAMES[state.plan];
  document.getElementById('sumDuration').textContent = monthLabel;
  document.getElementById('sumCurrency').textContent = symbol;
  document.getElementById('sumTotal').textContent = formatUsd(usd);
  document.getElementById('sumCryptoAmount').textContent = `${crypto} ${symbol}`;
}

/* ─── PLAN TABS ─────────────────────────────────────────────────────────────── */
document.querySelectorAll('.plan-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    state.plan = btn.dataset.plan;
    document.querySelectorAll('.plan-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateSummary();
  });
});

/* ─── DURATION ──────────────────────────────────────────────────────────────── */
document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.months = parseInt(btn.dataset.months);
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateSummary();
  });
});

/* ─── CURRENCY ──────────────────────────────────────────────────────────────── */
document.querySelectorAll('.cur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.currency = btn.dataset.currency;
    document.querySelectorAll('.cur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Auto-select best network for currency
    if (state.currency === 'sol') {
      selectNetwork('solana');
    } else {
      selectNetwork('ethereum');
    }
    updateSummary();
  });
});

/* ─── FAQ ACCORDION ─────────────────────────────────────────────────────────── */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

/* ─── MODAL ─────────────────────────────────────────────────────────────────── */
const overlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const checkoutBtn = document.getElementById('checkoutBtn');
let countdownInterval = null;

function openModal() {
  const email = document.getElementById('emailInput').value.trim();
  if (!email || !email.includes('@')) {
    document.getElementById('emailInput').focus();
    document.getElementById('emailInput').style.borderColor = '#f87171';
    setTimeout(() => { document.getElementById('emailInput').style.borderColor = ''; }, 2000);
    return;
  }

  const crypto = getCryptoAmount();
  const symbol = CURRENCY_NAMES[state.currency];

  document.getElementById('modalAmount').textContent = `${crypto} ${symbol}`;
  updateDepositAddress();
  startCountdown(30 * 60);
  overlay.classList.add('active');
  generateQR();
}

function closeModal() {
  overlay.classList.remove('active');
  if (countdownInterval) clearInterval(countdownInterval);
}

checkoutBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

/* ─── NETWORK TABS ──────────────────────────────────────────────────────────── */
document.querySelectorAll('.net-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    selectNetwork(btn.dataset.net);
  });
});

function selectNetwork(net) {
  state.network = net;
  document.querySelectorAll('.net-tab').forEach(b => b.classList.remove('active'));
  const tab = document.querySelector(`.net-tab[data-net="${net}"]`);
  if (tab) tab.classList.add('active');
  updateDepositAddress();
}

function updateDepositAddress() {
  document.getElementById('depositAddress').textContent = ADDRESSES[state.network];
  generateQR();
}

/* ─── COPY ADDRESS ──────────────────────────────────────────────────────────── */
document.getElementById('copyBtn').addEventListener('click', () => {
  const address = ADDRESSES[state.network];
  navigator.clipboard.writeText(address).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    btn.style.background = '#22c55e';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = ''; }, 2000);
  });
});

/* ─── QR CODE (CSS-based) ────────────────────────────────────────────────────── */
function generateQR() {
  // Simple visual QR placeholder — in production use qrcode.js
  const qr = document.getElementById('qrCode');
  const address = ADDRESSES[state.network];
  // Create a deterministic pattern based on address
  let html = '';
  const size = 14;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const charCode = address.charCodeAt((r * size + c) % address.length);
      const dark = (charCode + r + c) % 3 !== 0;
      html += `<div style="width:10px;height:10px;background:${dark?'#000':'#fff'};display:inline-block;"></div>`;
    }
    html += '<br/>';
  }
  qr.innerHTML = html;
  qr.style.fontSize = 0;
  qr.style.lineHeight = '10px';
}

/* ─── COUNTDOWN ─────────────────────────────────────────────────────────────── */
function startCountdown(seconds) {
  if (countdownInterval) clearInterval(countdownInterval);
  let remaining = seconds;
  const el = document.getElementById('countdown');

  function tick() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      el.textContent = 'Expired';
      el.style.color = '#f87171';
    }
    remaining--;
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

/* ─── SIMULATE PAYMENT DETECTION ────────────────────────────────────────────── */
// In production this would poll a backend or use websockets
function simulatePaymentFlow() {
  let phase = 0;
  const steps = ['mstep1', 'mstep2', 'mstep3'];
  const interval = setInterval(() => {
    phase++;
    if (phase < steps.length) {
      document.getElementById(steps[phase]).classList.add('active');
    }
    if (phase >= steps.length - 1) {
      clearInterval(interval);
      setTimeout(() => {
        document.getElementById('modalAmount').parentElement.innerHTML =
          '<strong style="color:#22c55e;font-size:16px;">✓ Payment confirmed! Subscription will be sent to your email.</strong>';
      }, 1000);
    }
  }, 4000);
}

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
updateSummary();
