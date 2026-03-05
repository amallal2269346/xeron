/* =============================================
   RUGRADAR — Solana Token Security Scanner
   Main Script
   ============================================= */

'use strict';

/* ─── Navbar scroll ─── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ─── Hamburger ─── */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger?.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});
mobileMenu?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

/* ─── Particle canvas ─── */
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const COLOURS = ['rgba(153,69,255,', 'rgba(20,241,149,', 'rgba(0,210,255,'];

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  function spawn() {
    return {
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      r: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.6 + 0.2,
      col: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      opacity: Math.random() * 0.5 + 0.1,
      drift: (Math.random() - 0.5) * 0.3,
    };
  }

  for (let i = 0; i < 60; i++) {
    const p = spawn();
    p.y = Math.random() * canvas.height;
    particles.push(p);
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
      p.y -= p.speed;
      p.x += p.drift;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.col + p.opacity + ')';
      ctx.fill();
      if (p.y < -10) particles[i] = spawn();
    });
    requestAnimationFrame(frame);
  }
  frame();
})();

/* ─── Counter animation ─── */
function animateCount(el, target, duration = 1800, suffix = '') {
  const start = performance.now();
  const update = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const value = Math.round(ease * target);
    el.textContent = value.toLocaleString() + suffix;
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const count   = +el.dataset.count;
    const percent = el.dataset.percent;
    if (count)   animateCount(el, count);
    if (percent) {
      const target = parseFloat(percent);
      const start = performance.now();
      const update = (now) => {
        const t = Math.min((now - start) / 1800, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = (ease * target).toFixed(1) + '%';
        if (t < 1) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    }
    observer.unobserve(el);
  });
}, { threshold: 0.3 });

document.querySelectorAll('[data-count],[data-percent]').forEach(el => observer.observe(el));

/* ─── FAQ ─── */
document.querySelectorAll('.faq-item').forEach(item => {
  item.querySelector('.faq-question').addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(o => o.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

/* ─── Search box clear ─── */
const tokenInput  = document.getElementById('tokenInput');
const searchClear = document.getElementById('searchClear');
tokenInput?.addEventListener('input', () => {
  searchClear.style.display = tokenInput.value ? 'block' : 'none';
});
searchClear?.addEventListener('click', () => {
  tokenInput.value = '';
  searchClear.style.display = 'none';
  tokenInput.focus();
});

/* ─── Quick tokens ─── */
document.querySelectorAll('.quick-token').forEach(btn => {
  btn.addEventListener('click', () => {
    tokenInput.value = btn.dataset.addr;
    searchClear.style.display = 'block';
    tokenInput.focus();
  });
});

/* ─── Recent scans table (static demo data) ─── */
const DEMO_SCANS = [
  { name: 'USD Coin',    sym: 'USDC',      addr: 'EPjFWdd5...Dt1v', score: 6,  verdict: 'safe',   mint: false, liq: 'Locked',   time: '2m ago',  col: '#2775CA' },
  { name: 'Raydium',    sym: 'RAY',       addr: '4k3Dyjzv...kX6R', score: 12, verdict: 'safe',   mint: false, liq: 'Burned',   time: '4m ago',  col: '#3F74E4' },
  { name: 'BONK',       sym: 'BONK',      addr: 'DezXAZ8z...B263', score: 21, verdict: 'safe',   mint: false, liq: 'Locked',   time: '5m ago',  col: '#F5A623' },
  { name: 'MoonPepe',   sym: 'MOONPE',    addr: '7xKXtg2C...9JfG', score: 61, verdict: 'warn',   mint: true,  liq: 'Unlocked', time: '8m ago',  col: '#3DCB64' },
  { name: 'ScamToken',  sym: 'SCAM',      addr: 'AbCdEf1G...2345', score: 96, verdict: 'danger', mint: true,  liq: 'None',     time: '12m ago', col: '#FF4444' },
  { name: 'Wrapped SOL',sym: 'wSOL',      addr: 'So111111...1112', score: 4,  verdict: 'safe',   mint: false, liq: 'N/A',      time: '15m ago', col: '#9945FF' },
  { name: 'FakeDrop',   sym: 'FDROP',     addr: 'Fake1234...5678', score: 89, verdict: 'danger', mint: true,  liq: 'None',     time: '19m ago', col: '#FF4444' },
  { name: 'PopCat',     sym: 'POPCAT',    addr: '7GCihgDB...2hr',  score: 34, verdict: 'safe',   mint: false, liq: 'Burned',   time: '24m ago', col: '#FF6B35' },
  { name: 'ShadyMeme',  sym: 'SHADY',     addr: 'Sh4dy000...999z', score: 74, verdict: 'warn',   mint: true,  liq: 'Partial',  time: '31m ago', col: '#8B5CF6' },
  { name: 'Jupiter',    sym: 'JUP',       addr: 'JUPyiwrY...7nkz', score: 8,  verdict: 'safe',   mint: false, liq: 'Locked',   time: '38m ago', col: '#2BC4AE' },
];

function scoreClass(score) {
  if (score < 30) return 'safe';
  if (score < 65) return 'warn';
  return 'danger';
}

function buildScansTable() {
  const tbody = document.getElementById('scansTableBody');
  if (!tbody) return;
  tbody.innerHTML = DEMO_SCANS.map(s => {
    const cls = scoreClass(s.score);
    const mintCls = s.mint ? 'yes' : 'no';
    const mintLabel = s.mint ? 'Active' : 'Revoked';
    return `
      <tr>
        <td>
          <div class="scan-token-cell">
            <div class="scan-avatar" style="background:${s.col}22;color:${s.col};border:1px solid ${s.col}44">
              ${s.sym.slice(0,2)}
            </div>
            <div>
              <div class="scan-token-name">${s.name}</div>
              <div class="scan-token-sym">${s.sym}</div>
            </div>
          </div>
        </td>
        <td><span class="scan-addr">${s.addr}</span></td>
        <td><span class="score-pill ${cls}">${s.score}/100</span></td>
        <td><span class="verdict-pill ${cls}">${cls === 'safe' ? '✅ Safe' : cls === 'warn' ? '⚠️ Caution' : '🚨 High Risk'}</span></td>
        <td><span class="auth-pill ${mintCls}">${mintLabel}</span></td>
        <td><span style="font-size:0.82rem;color:var(--text-secondary)">${s.liq}</span></td>
        <td><span class="scan-time">${s.time}</span></td>
        <td><button class="scan-btn-sm">View</button></td>
      </tr>
    `;
  }).join('');
}
buildScansTable();

/* ─── Token analysis simulation ─── */
// Deterministic "hash" from address string for consistent demo results
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Known "safe" tokens for realistic demo
const SAFE_TOKENS = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { name: 'USD Coin', sym: 'USDC', mcap: '$42.1B', vol: '$8.4B', holders: '2,847,193', age: '3.1 years', col: '#2775CA', riskOverride: 6 },
  'So11111111111111111111111111111111111111112':    { name: 'Wrapped SOL', sym: 'wSOL', mcap: '$72.4B', vol: '$3.2B', holders: '1,204,771', age: '3.8 years', col: '#9945FF', riskOverride: 4 },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { name: 'BONK', sym: 'BONK', mcap: '$1.8B', vol: '$312M', holders: '714,382', age: '1.2 years', col: '#F5A623', riskOverride: 21 },
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': { name: 'PopCat', sym: 'POPCAT', mcap: '$890M', vol: '$124M', holders: '89,442', age: '8 months', col: '#FF6B35', riskOverride: 34 },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { name: 'Raydium', sym: 'RAY', mcap: '$780M', vol: '$98M', holders: '213,904', age: '3.0 years', col: '#3F74E4', riskOverride: 12 },
};

function generateTokenData(address) {
  const known = SAFE_TOKENS[address];
  const h = hashStr(address);
  const risk = known ? known.riskOverride : (h % 95) + 2;

  const factors = known
    ? safeFactor(risk)
    : generateFactors(risk, h);

  const mcapNum = known ? null : (h % 900 + 10);
  const volNum  = known ? null : Math.round(mcapNum * (0.05 + (h % 40) / 100));

  return {
    name:    known ? known.name : `Token ${address.slice(0, 6)}`,
    sym:     known ? known.sym : address.slice(0, 4).toUpperCase(),
    col:     known ? known.col : `hsl(${h % 360},70%,55%)`,
    mcap:    known ? known.mcap : `$${mcapNum}M`,
    vol:     known ? known.vol  : `$${volNum}M`,
    holders: known ? known.holders : `${((h % 80) + 1) * 1000}`,
    age:     known ? known.age  : `${(h % 18) + 1} months`,
    score:   risk,
    factors,
    holders_data: generateHolders(risk, h),
    flags: generateFlags(risk, factors, h),
  };
}

function safeFactor(risk) {
  const s = risk;
  return [
    { label: 'Mint Authority',     sub: 'Revoked / Burned',  status: 'safe',   score: Math.min(s, 10) },
    { label: 'Freeze Authority',   sub: 'Revoked',           status: 'safe',   score: Math.min(s, 8)  },
    { label: 'Liquidity',          sub: 'Locked / Burned',   status: 'safe',   score: Math.min(s, 12) },
    { label: 'Holder Spread',      sub: 'Well distributed',  status: 'safe',   score: Math.min(s, 15) },
    { label: 'Trading Pattern',    sub: 'Natural activity',  status: 'safe',   score: Math.min(s, 10) },
    { label: 'Contract Metadata',  sub: 'Verified',          status: 'safe',   score: Math.min(s, 8)  },
  ];
}

function generateFactors(risk, h) {
  const levels = ['safe', 'warn', 'danger'];
  function factorLevel(baseScore) {
    const jitter = (h % 20) - 10;
    const val = Math.max(0, Math.min(100, baseScore + jitter));
    const status = val < 25 ? 'safe' : val < 60 ? 'warn' : 'danger';
    return { score: val, status };
  }
  const liqScore   = risk > 70 ? risk - 10 : risk * 0.6;
  const mintScore  = risk > 60 ? 80 : risk * 0.3;
  const holderScore= risk * 0.7;
  const tradeScore = risk * 0.5;
  const metaScore  = risk * 0.4;
  const freezeScore= risk > 65 ? 70 : risk * 0.2;
  return [
    { label: 'Mint Authority',    sub: mintScore > 50 ? 'Active — HIGH RISK' : mintScore > 25 ? 'Delegated' : 'Revoked', ...factorLevel(mintScore) },
    { label: 'Freeze Authority',  sub: freezeScore > 50 ? 'Active — DANGER' : 'Revoked',   ...factorLevel(freezeScore) },
    { label: 'Liquidity',         sub: liqScore > 60 ? 'Unlocked — RISK' : liqScore > 30 ? 'Partial lock' : 'Burned',    ...factorLevel(liqScore) },
    { label: 'Holder Spread',     sub: holderScore > 60 ? 'Top 5 hold >60%' : 'Moderate',  ...factorLevel(holderScore) },
    { label: 'Trading Pattern',   sub: tradeScore > 50 ? 'Wash trading detected' : 'Normal',  ...factorLevel(tradeScore) },
    { label: 'Contract Metadata', sub: metaScore > 50 ? 'Unverified' : 'Verified',           ...factorLevel(metaScore) },
  ];
}

function generateHolders(risk, h) {
  const base = [];
  const topPct = risk > 70 ? 30 + (h % 20) : risk > 40 ? 12 + (h % 15) : 4 + (h % 8);
  const labels = ['Dev Wallet', 'LP Pool', 'Exchange', 'Wallet 4', 'Wallet 5', 'Wallet 6', 'Others (combined)'];
  let remaining = 100;
  for (let i = 0; i < 7; i++) {
    let pct;
    if (i === 0) pct = topPct;
    else if (i === 6) pct = remaining;
    else {
      const maxPct = remaining / (7 - i);
      pct = Math.min(remaining, Math.round(maxPct * (0.3 + Math.random() * 0.7)));
    }
    remaining -= pct;
    base.push({ label: labels[i], pct, danger: i === 0 && pct > 20, warn: i === 0 && pct > 10 });
  }
  return base;
}

const FLAG_TEMPLATES = {
  danger: [
    { title: 'Mint Authority Active', desc: 'The developer wallet retains mint authority. They can print unlimited tokens at any time, collapsing the price instantly.' },
    { title: 'Freeze Authority Enabled', desc: 'Freeze authority is active. The deployer can freeze all token transfers at any moment, creating a honeypot scenario.' },
    { title: 'Liquidity Completely Unlocked', desc: 'No LP tokens have been burned or locked. The developer can drain the entire liquidity pool at any time.' },
    { title: 'Extreme Holder Concentration', desc: 'The top 1-3 wallets control over 50% of circulating supply. A coordinated dump would crater the price to near zero.' },
  ],
  warn: [
    { title: 'Partial Liquidity Lock', desc: 'Only a portion of LP tokens are locked. The unlocked portion can be withdrawn by the developer.' },
    { title: 'Elevated Dev Wallet Holdings', desc: 'The deployer wallet holds 10-20% of supply. This is above recommended safe thresholds.' },
    { title: 'Young Token (< 30 days)', desc: 'This token was created very recently. New tokens carry higher risk until track record is established.' },
    { title: 'Low Trading Volume', desc: 'Thin trading volume can be easily manipulated. Low liquidity also means larger slippage on sells.' },
  ],
  safe: [
    { title: 'Mint Authority Revoked', desc: 'Mint authority has been permanently revoked. No new tokens can ever be created.' },
    { title: 'Liquidity Locked / Burned', desc: 'LP tokens have been burned or locked in a time-lock contract. Liquidity cannot be removed.' },
    { title: 'Healthy Holder Distribution', desc: 'Token supply is well distributed across many independent wallets with no single dominant holder.' },
  ],
};

function generateFlags(risk, factors, h) {
  const flags = [];
  factors.forEach(f => {
    if (f.status === 'danger') {
      const tmpl = FLAG_TEMPLATES.danger[flags.filter(x => x.type === 'danger').length % FLAG_TEMPLATES.danger.length];
      flags.push({ type: 'danger', ...tmpl });
    } else if (f.status === 'warn') {
      const tmpl = FLAG_TEMPLATES.warn[flags.filter(x => x.type === 'warn').length % FLAG_TEMPLATES.warn.length];
      flags.push({ type: 'warn', ...tmpl });
    }
  });
  if (risk < 30) {
    FLAG_TEMPLATES.safe.forEach(t => flags.push({ type: 'safe', ...t }));
  }
  return flags.slice(0, 6);
}

/* ─── Risk gauge ─── */
function setGauge(score) {
  const gaugeFill   = document.getElementById('gaugeFill');
  const gaugeNeedle = document.getElementById('gaugeNeedle');
  const gaugeScore  = document.getElementById('gaugeScore');
  if (!gaugeFill) return;

  // Arc from left (20,100) to right (180,100), semicircle
  // Score 0 = far left, 100 = far right
  const cx = 100, cy = 100, r = 80;
  const startAngle = 180; // degrees (left)
  const endAngle   = 0;   // degrees (right)
  const angle = 180 - (score / 100) * 180; // 180deg → 0deg

  function polar(deg) {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  }

  const fillEnd = polar(angle);
  const large   = score > 50 ? 1 : 0;
  const start   = polar(180);
  gaugeFill.setAttribute('d', `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${fillEnd.x} ${fillEnd.y}`);

  // Colour
  const col = score < 30 ? '#14F195' : score < 65 ? '#F5C542' : '#FF4444';
  gaugeFill.setAttribute('stroke', col);

  // Needle
  const needleAngle = angle;
  const needleEnd = polar(needleAngle);
  gaugeNeedle.setAttribute('x2', needleEnd.x);
  gaugeNeedle.setAttribute('y2', needleEnd.y);

  // Score text animation
  let current = 0;
  const target = score;
  const step = () => {
    current = Math.min(current + 2, target);
    gaugeScore.textContent = current;
    gaugeScore.setAttribute('fill', col);
    if (current < target) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ─── Verdict ─── */
function setVerdict(score) {
  const badge = document.getElementById('verdictBadge');
  const desc  = document.getElementById('verdictDesc');
  if (!badge) return;
  badge.className = 'verdict-badge';
  if (score < 25) {
    badge.classList.add('safe');
    badge.textContent = '✅ LOW RISK';
    desc.textContent = 'This token shows no major red flags. Always DYOR before investing.';
  } else if (score < 55) {
    badge.classList.add('safe');
    badge.textContent = '🔵 MODERATE';
    desc.textContent = 'Some caution warranted. Review the flagged items carefully.';
  } else if (score < 75) {
    badge.classList.add('warn');
    badge.textContent = '⚠️ HIGH CAUTION';
    desc.textContent = 'Multiple risk factors detected. Proceed only after thorough research.';
  } else {
    badge.classList.add('danger');
    badge.textContent = '🚨 LIKELY RUG';
    desc.textContent = 'Critical red flags detected. This token exhibits rug pull indicators.';
  }
}

/* ─── Render risk factors ─── */
function renderRiskFactors(factors) {
  const grid = document.getElementById('riskFactorsGrid');
  if (!grid) return;
  const icons = { safe: '✅', warn: '⚠️', danger: '🚫' };
  grid.innerHTML = factors.map(f => `
    <div class="rf-item">
      <div class="rf-item-left">
        <div class="rf-item-icon ${f.status}">${icons[f.status]}</div>
        <div>
          <div class="rf-item-label">${f.label}</div>
          <div class="rf-item-sub">${f.sub}</div>
        </div>
      </div>
      <div class="rf-item-score ${f.status}">${f.score}</div>
    </div>
  `).join('');
}

/* ─── Render flags ─── */
function renderFlags(flags) {
  const list = document.getElementById('flagsList');
  if (!list) return;
  const icons = { safe: '✅', warn: '⚠️', danger: '🚨' };
  if (!flags.length) {
    list.innerHTML = '<div class="flag-item safe"><span class="flag-icon">✅</span><div class="flag-text">No significant risk flags detected.</div></div>';
    return;
  }
  list.innerHTML = flags.map(f => `
    <div class="flag-item ${f.type}">
      <span class="flag-icon">${icons[f.type]}</span>
      <div class="flag-text">
        <strong>${f.title}</strong>
        ${f.desc}
      </div>
    </div>
  `).join('');
}

/* ─── Render holder bars ─── */
function renderHolders(holders) {
  const container = document.getElementById('holderBars');
  if (!container) return;
  container.innerHTML = holders.map(h => {
    const cls = h.danger ? 'red' : h.warn ? 'warn' : '';
    const col = h.danger ? 'var(--danger)' : h.warn ? 'var(--warn)' : 'var(--safe)';
    return `
      <div class="holder-row">
        <div class="holder-label" title="${h.label}">${h.label}</div>
        <div class="holder-bar-wrap">
          <div class="holder-bar-fill ${cls}" style="width:0%" data-target="${h.pct}"></div>
        </div>
        <div class="holder-pct" style="color:${col}">${h.pct}%</div>
      </div>
    `;
  }).join('');
  // Animate bars
  setTimeout(() => {
    container.querySelectorAll('.holder-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  }, 100);
}

/* ─── Scan progress UI ─── */
const STEPS = ['step1','step2','step3','step4','step5','step6'];
const STEP_LABELS = ['Fetching on-chain data','Analyzing token authority','Checking liquidity pools','Inspecting holder distribution','Scanning trading patterns','Generating risk report'];

function runScanProgress(onComplete) {
  const progBar = document.getElementById('progBarFill');
  const statusText = document.getElementById('statusText');
  const statusDot  = document.querySelector('.scanner-status .status-dot');

  STEPS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active','done');
    el.classList.add('pending');
    el.querySelector('.step-indicator').innerHTML = '<div class="step-dot"></div>';
  });

  if (statusDot) { statusDot.className = 'status-dot scanning'; }
  if (statusText) statusText.textContent = 'Scanning…';

  const delays = [0, 550, 950, 1400, 1850, 2350];
  const totalDuration = 2900;

  STEPS.forEach((id, i) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('pending');
      el.classList.add('active');
      el.querySelector('.step-indicator').innerHTML = '<div class="step-spinner"></div>';

      // Complete previous
      if (i > 0) {
        const prev = document.getElementById(STEPS[i-1]);
        if (prev) {
          prev.classList.remove('active');
          prev.classList.add('done');
          prev.querySelector('.step-indicator').innerHTML = '<div class="step-dot"></div>';
        }
      }

      const pct = Math.round(((i + 1) / STEPS.length) * 100);
      if (progBar) progBar.style.width = pct + '%';
    }, delays[i]);
  });

  setTimeout(() => {
    const last = document.getElementById(STEPS[STEPS.length - 1]);
    if (last) {
      last.classList.remove('active');
      last.classList.add('done');
      last.querySelector('.step-indicator').innerHTML = '<div class="step-dot"></div>';
    }
    if (progBar) progBar.style.width = '100%';
    if (statusDot) statusDot.className = 'status-dot done';
    if (statusText) statusText.textContent = 'Complete';
    onComplete();
  }, totalDuration);
}

/* ─── Main scan function ─── */
let scanning = false;

function startScan() {
  const addr = tokenInput.value.trim();
  if (!addr || scanning) return;
  scanning = true;

  const scanBtn  = document.getElementById('scanBtn');
  const scanText = document.getElementById('scanBtnText');
  const scanProg = document.getElementById('scanProgress');
  const scanRes  = document.getElementById('scanResults');

  scanBtn.disabled = true;
  if (scanText) scanText.textContent = 'Scanning…';
  if (scanRes) scanRes.style.display = 'none';
  if (scanProg) scanProg.style.display = 'block';

  // Scroll to scanner
  document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  runScanProgress(() => {
    const data = generateTokenData(addr);

    // Populate header
    const tokenAvatar  = document.getElementById('tokenAvatar');
    if (tokenAvatar) {
      tokenAvatar.textContent = data.sym.slice(0,2);
      tokenAvatar.style.background = data.col + '22';
      tokenAvatar.style.color = data.col;
      tokenAvatar.style.border = `1px solid ${data.col}44`;
    }
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('tokenName',    `${data.name} (${data.sym})`);
    set('tokenAddr',    addr.length > 20 ? addr.slice(0,10) + '…' + addr.slice(-8) : addr);
    set('tokenMcap',    data.mcap);
    set('tokenVolume',  data.vol);
    set('tokenHolders', data.holders);
    set('tokenAge',     data.age);

    // Gauge + verdict
    setGauge(data.score);
    setVerdict(data.score);
    renderRiskFactors(data.factors);
    renderFlags(data.flags);
    renderHolders(data.holders_data);

    // Show results
    if (scanProg) scanProg.style.display = 'none';
    if (scanRes) {
      scanRes.style.display = 'block';
      scanRes.classList.add('animate-in');
    }

    if (scanBtn) scanBtn.disabled = false;
    if (scanText) scanText.textContent = 'Scan Token';
    scanning = false;
  });
}

/* ─── Scan button + Enter key ─── */
document.getElementById('scanBtn')?.addEventListener('click', startScan);
tokenInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') startScan();
});

/* ─── New scan button ─── */
document.getElementById('newScanBtn')?.addEventListener('click', () => {
  const scanRes = document.getElementById('scanResults');
  if (scanRes) scanRes.style.display = 'none';
  tokenInput.value = '';
  searchClear.style.display = 'none';
  document.getElementById('statusText').textContent = 'Ready';
  document.querySelector('.scanner-status .status-dot').className = 'status-dot ready';
  tokenInput.focus();
  document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ─── Share scan ─── */
document.getElementById('shareScanBtn')?.addEventListener('click', () => {
  const addr = tokenInput.value.trim();
  const url = window.location.href.split('?')[0] + '?token=' + encodeURIComponent(addr);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('shareScanBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    });
  }
});

/* ─── Auto-scan from URL param ─── */
(function checkUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token && tokenInput) {
    tokenInput.value = token;
    searchClear.style.display = 'block';
    setTimeout(startScan, 800);
  }
})();

/* ─── Smooth scroll for nav links ─── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ─── Table "View" buttons ─── */
document.addEventListener('click', e => {
  if (e.target.classList.contains('scan-btn-sm')) {
    const row = e.target.closest('tr');
    const addr = row?.querySelector('.scan-addr')?.textContent;
    if (addr && tokenInput) {
      // Find full address from demo data by matching shortened
      const full = DEMO_SCANS.find(s => s.addr === addr);
      document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        tokenInput.value = full ? full.addr : addr;
        searchClear.style.display = 'block';
        startScan();
      }, 500);
    }
  }
});

/* ─── Intersection observer for section reveals ─── */
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.step-card, .rf-card, .big-stat-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  sectionObserver.observe(el);
});
