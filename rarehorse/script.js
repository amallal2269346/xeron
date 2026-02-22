/* =============================================
   RARE HORSES — Main JavaScript
   ============================================= */

/* ---- NAVBAR SCROLL ---- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

/* ---- MOBILE MENU ---- */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});
// Close mobile menu on link click
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

/* ---- FAQ ACCORDION ---- */
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const isOpen = item.classList.contains('open');
    // Close all
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    // Toggle clicked
    if (!isOpen) item.classList.add('open');
  });
});

/* ---- MINT QUANTITY ---- */
const qtyMinus = document.getElementById('qtyMinus');
const qtyPlus  = document.getElementById('qtyPlus');
const qtyValue = document.getElementById('qtyValue');
const mintTotal = document.getElementById('mintTotal');
const PRICE = 0.08;
let qty = 1;

function updateMint() {
  qtyValue.textContent = qty;
  mintTotal.textContent = (qty * PRICE).toFixed(2) + ' ETH';
  qtyMinus.disabled = qty <= 1;
  qtyPlus.disabled  = qty >= 5;
}

qtyMinus.addEventListener('click', () => { if (qty > 1) { qty--; updateMint(); } });
qtyPlus.addEventListener('click',  () => { if (qty < 5) { qty++; updateMint(); } });

/* ---- MINT BUTTON ---- */
const mintBtn = document.getElementById('mintBtn');
let walletConnected = false;
mintBtn.addEventListener('click', () => {
  if (!walletConnected) {
    mintBtn.textContent = 'Connecting...';
    setTimeout(() => {
      walletConnected = true;
      mintBtn.textContent = `Mint ${qty} Horse${qty > 1 ? 's' : ''} — ${(qty * PRICE).toFixed(2)} ETH`;
      mintBtn.style.background = 'linear-gradient(135deg, #10b981, #3b82f6)';
    }, 1200);
  } else {
    mintBtn.textContent = 'Processing...';
    mintBtn.disabled = true;
    setTimeout(() => {
      mintBtn.textContent = '✅ Minted Successfully!';
      mintBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    }, 2000);
  }
});

/* ---- FLOATING PARTICLES ---- */
const particlesContainer = document.getElementById('particles');
const PARTICLE_COUNT = 20;
const PARTICLE_EMOJIS = ['🐴', '✨', '💎', '⭐', '🌟', '👑', '🔥'];

function createParticle() {
  const el = document.createElement('span');
  el.classList.add('particle');
  const emoji = PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)];
  el.textContent = emoji;
  el.style.cssText = `
    font-size: ${8 + Math.random() * 14}px;
    left: ${Math.random() * 100}%;
    animation-duration: ${8 + Math.random() * 14}s;
    animation-delay: ${Math.random() * 10}s;
    opacity: 0;
  `;
  particlesContainer.appendChild(el);
}

for (let i = 0; i < PARTICLE_COUNT; i++) {
  createParticle();
}

/* ---- SMOOTH SCROLL FOR NAV LINKS ---- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

/* ---- SCROLL REVEAL ANIMATION ---- */
const revealEls = document.querySelectorAll(
  '.nft-card, .rarity-card, .team-card, .timeline-item, .trait-chip, .faq-item'
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
);

revealEls.forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = `opacity 0.5s ease ${i * 0.06}s, transform 0.5s ease ${i * 0.06}s`;
  observer.observe(el);
});

/* ---- RARITY BAR ANIMATION ---- */
const rarityBars = document.querySelectorAll('.rarity-bar');
const rarityObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.width = getComputedStyle(entry.target).getPropertyValue('--pct');
        rarityObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);
rarityBars.forEach(bar => {
  bar.style.width = '0';
  rarityObserver.observe(bar);
});

/* ---- COUNTDOWN TIMER ---- */
function startCountdown() {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  deadline.setHours(deadline.getHours() + 7);
  deadline.setMinutes(deadline.getMinutes() + 42);

  const timerEl = document.getElementById('countdownTimer');
  if (!timerEl) return;

  function tick() {
    const now = new Date();
    const diff = deadline - now;
    if (diff <= 0) {
      timerEl.innerHTML = '<span class="cd-unit"><span class="cd-val">00</span><span class="cd-label">Days</span></span><span class="cd-sep">:</span><span class="cd-unit"><span class="cd-val">00</span><span class="cd-label">Hrs</span></span><span class="cd-sep">:</span><span class="cd-unit"><span class="cd-val">00</span><span class="cd-label">Min</span></span><span class="cd-sep">:</span><span class="cd-unit"><span class="cd-val">00</span><span class="cd-label">Sec</span></span>';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    timerEl.innerHTML = `
      <span class="cd-unit"><span class="cd-val">${pad(d)}</span><span class="cd-label">Days</span></span>
      <span class="cd-sep">:</span>
      <span class="cd-unit"><span class="cd-val">${pad(h)}</span><span class="cd-label">Hrs</span></span>
      <span class="cd-sep">:</span>
      <span class="cd-unit"><span class="cd-val">${pad(m)}</span><span class="cd-label">Min</span></span>
      <span class="cd-sep">:</span>
      <span class="cd-unit"><span class="cd-val">${pad(s)}</span><span class="cd-label">Sec</span></span>`;
  }
  tick();
  setInterval(tick, 1000);
}
startCountdown();

/* ---- NFT LIGHTBOX ---- */
const lightbox = document.getElementById('nftLightbox');
const lbImg    = document.getElementById('lbImg');
const lbName   = document.getElementById('lbName');
const lbTier   = document.getElementById('lbTier');
const lbPrice  = document.getElementById('lbPrice');
const lbClose  = document.getElementById('lbClose');

document.querySelectorAll('.nft-view-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const card    = btn.closest('.nft-card');
    const img     = card.querySelector('img');
    const name    = card.querySelector('.nft-name').textContent;
    const tier    = card.querySelector('.nft-tier').textContent;
    const price   = card.querySelector('.price-value')?.textContent || '';
    const tierCls = card.querySelector('.nft-tier').className.replace('nft-tier','').trim();
    if (!img || !lightbox) return;
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbName.textContent = name;
    lbTier.textContent = tier;
    lbTier.className = 'lb-tier nft-tier ' + tierCls;
    lbPrice.textContent = price;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
});

if (lbClose) {
  lbClose.addEventListener('click', closeLightbox);
}
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});
function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

/* ---- MINT PROGRESS BAR ANIMATION ---- */
const mintFill = document.querySelector('.mint-progress-fill');
if (mintFill) {
  const targetWidth = mintFill.style.width;
  mintFill.style.width = '0';
  const mintProgressObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => { mintFill.style.width = targetWidth; }, 300);
          mintProgressObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  mintProgressObserver.observe(mintFill);
}
