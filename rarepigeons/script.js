/* =============================================
   RARE PIGEONS — Main JavaScript
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
      mintBtn.textContent = `Mint ${qty} Pigeon${qty > 1 ? 's' : ''} — ${(qty * PRICE).toFixed(2)} ETH`;
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
const PARTICLE_EMOJIS = ['🕊️', '✨', '💎', '⭐', '🌟', '👑', '🔥', '🪶'];

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
