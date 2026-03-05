/**
 * script.js — Rare Pigeons Website
 * =============================================================
 * Sections
 * --------
 * 1.  Utility helpers
 * 2.  Reduced-motion detection
 * 3.  Navbar: scroll → frosted-glass effect
 * 4.  Mobile menu: hamburger toggle + close on link click
 * 5.  FAQ accordion: aria-compliant open / close
 * 6.  Mint widget: quantity stepper + dynamic price total
 * 7.  Mint button: simulated wallet-connect / mint flow
 * 8.  Floating particles: decorative hero background
 * 9.  Scroll-reveal: fade-in + slide-up on scroll
 * 10. Rarity bar animation: width transition on scroll
 * 11. Mint progress bar animation: width transition on scroll
 * 12. Smooth scroll: offset for fixed navbar height
 * =============================================================
 */

'use strict';

/* =============================================================
   1. UTILITY HELPERS
   Small reusable functions kept at the top for clarity.
============================================================= */

/**
 * Shorthand for document.getElementById.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
const byId = (id) => document.getElementById(id);

/**
 * Shorthand for document.querySelectorAll, returns an Array
 * (easier to use .forEach on than a NodeList in all environments).
 * @param {string} selector
 * @param {Element} [root=document]
 * @returns {Element[]}
 */
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));


/* =============================================================
   2. REDUCED-MOTION DETECTION
   Users can set "Prefer reduced motion" in their OS accessibility
   settings. Honouring this removes animations that can cause
   problems for people with vestibular disorders.
   CSS handles most animation suppression (see the
   @media (prefers-reduced-motion) block in style.css).
   JS checks the same media query to skip timers / WAAPI calls.
============================================================= */
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;


/* =============================================================
   3. NAVBAR — SCROLL EFFECT
   Adds .scrolled class when the user scrolls past 40 px.
   The class triggers a frosted-glass background in CSS.
============================================================= */
(function initNavbarScroll() {
  const navbar = byId('navbar');
  if (!navbar) return;

  function onScroll() {
    // Toggle .scrolled based on scroll position
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }

  // Passive listener improves scroll performance
  window.addEventListener('scroll', onScroll, { passive: true });

  // Apply class immediately in case page loads mid-scroll
  onScroll();
})();


/* =============================================================
   4. MOBILE MENU
   - Hamburger button toggles the .open class on the menu panel.
   - aria-expanded attribute is kept in sync for screen readers.
   - Clicking any menu link closes the panel.
   - Pressing Escape also closes the panel.
============================================================= */
(function initMobileMenu() {
  const hamburger  = byId('hamburger');
  const mobileMenu = byId('mobileMenu');
  if (!hamburger || !mobileMenu) return;

  /** Opens or closes the mobile menu. */
  function toggleMenu(open) {
    mobileMenu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
  }

  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.contains('open');
    toggleMenu(!isOpen);
  });

  // Close when any link inside is clicked
  qsa('a', mobileMenu).forEach((link) => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      toggleMenu(false);
      hamburger.focus(); // return focus to the trigger button
    }
  });
})();


/* =============================================================
   5. FAQ ACCORDION
   ARIA pattern: each question is a <button> with:
     aria-expanded="true|false"
     aria-controls="<answer-panel-id>"
   The answer panel uses the HTML `hidden` attribute
   (better than display:none via CSS because AT still announces
   visibility changes correctly).
============================================================= */
(function initFaq() {
  const items = qsa('.faq-item');

  items.forEach((item) => {
    const btn    = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!btn || !answer) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close every item first (single-open accordion)
      items.forEach((i) => {
        i.classList.remove('open');
        const b = i.querySelector('.faq-question');
        const a = i.querySelector('.faq-answer');
        if (b) b.setAttribute('aria-expanded', 'false');
        if (a) a.hidden = true;
      });

      // Re-open clicked item if it was previously closed
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        answer.hidden = false;
      }
    });
  });
})();


/* =============================================================
   6. MINT WIDGET — QUANTITY STEPPER
   Quantity range: 1–5 (per-wallet maximum).
   Each change updates:
     - The displayed quantity (#qtyValue)
     - The total price (#mintTotal)
     - The disabled state of the ± buttons
     - The mint button label (if wallet is already connected)
============================================================= */
(function initMintStepper() {
  const qtyMinus  = byId('qtyMinus');
  const qtyPlus   = byId('qtyPlus');
  const qtyOutput = byId('qtyValue');
  const mintTotal = byId('mintTotal');
  if (!qtyMinus || !qtyPlus || !qtyOutput || !mintTotal) return;

  const PRICE_PER_NFT = 0.08; // ETH
  const MIN_QTY       = 1;
  const MAX_QTY       = 5;
  let   qty           = 1;

  /** Refreshes all quantity-dependent UI. */
  function updateUI() {
    qtyOutput.textContent = qty;
    mintTotal.textContent = (qty * PRICE_PER_NFT).toFixed(2) + ' ETH';

    // Grey out and disable the buttons at limits
    qtyMinus.disabled = qty <= MIN_QTY;
    qtyPlus.disabled  = qty >= MAX_QTY;

    // If wallet is already connected, keep button label in sync
    if (walletConnected) {
      const mintBtn = byId('mintBtn');
      if (mintBtn) {
        mintBtn.textContent = `Mint ${qty} Pigeon${qty > 1 ? 's' : ''} — ${(qty * PRICE_PER_NFT).toFixed(2)} ETH`;
      }
    }
  }

  qtyMinus.addEventListener('click', () => {
    if (qty > MIN_QTY) { qty--; updateUI(); }
  });

  qtyPlus.addEventListener('click', () => {
    if (qty < MAX_QTY) { qty++; updateUI(); }
  });

  // Expose qty getter for the mint button handler below
  window._getMintQty = () => qty;

  // Initial render
  updateUI();
})();


/* =============================================================
   7. MINT BUTTON — SIMULATED WALLET FLOW
   Phase 1 (wallet not connected): "Connect Wallet to Mint"
     → shows "Connecting…" for 1.2 s
     → transitions to "Mint N Pigeon(s) — X ETH"

   Phase 2 (wallet connected): "Mint N Pigeon(s) — X ETH"
     → shows "Processing…" for 2 s
     → shows "✅ Minted Successfully!"

   NOTE: This is purely a UI demo. No real blockchain calls are made.
============================================================= */
let walletConnected = false; // shared state (referenced by updateUI above)

(function initMintButton() {
  const mintBtn = byId('mintBtn');
  if (!mintBtn) return;

  mintBtn.addEventListener('click', () => {
    const PRICE_PER_NFT = 0.08;

    if (!walletConnected) {
      /* ---- Phase 1: simulate wallet connection ---- */
      mintBtn.textContent = 'Connecting…';
      mintBtn.disabled    = true;

      const delay = prefersReducedMotion ? 0 : 1200;

      setTimeout(() => {
        walletConnected       = true;
        mintBtn.disabled      = false;
        const qty             = (window._getMintQty && window._getMintQty()) || 1;
        mintBtn.textContent   = `Mint ${qty} Pigeon${qty > 1 ? 's' : ''} — ${(qty * PRICE_PER_NFT).toFixed(2)} ETH`;
        mintBtn.style.background = 'linear-gradient(135deg, #10b981, #3b82f6)';
      }, delay);

    } else {
      /* ---- Phase 2: simulate minting transaction ---- */
      mintBtn.textContent = 'Processing…';
      mintBtn.disabled    = true;

      const delay = prefersReducedMotion ? 0 : 2000;

      setTimeout(() => {
        mintBtn.textContent      = '✅ Minted Successfully!';
        mintBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        // Keep disabled so it is not clicked again (demo only)
      }, delay);
    }
  });
})();


/* =============================================================
   8. FLOATING PARTICLES
   Creates emoji sprites that float upward through the hero
   background. Each particle has a randomised:
     - emoji symbol
     - font size (8–22 px)
     - horizontal start position
     - animation duration (8–22 s)
     - animation delay (0–10 s)
   Skipped entirely when the user prefers reduced motion.
============================================================= */
(function initParticles() {
  if (prefersReducedMotion) return;  // respect user preference

  const container = byId('particles');
  if (!container) return;

  const EMOJIS = ['🕊️', '✨', '💎', '⭐', '🌟', '👑', '🔥', '🪶'];
  const COUNT  = 20;

  for (let i = 0; i < COUNT; i++) {
    const el    = document.createElement('span');
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

    el.classList.add('particle');
    el.textContent = emoji;
    el.setAttribute('aria-hidden', 'true');

    // Inline styles randomise each particle's appearance and timing
    el.style.cssText = [
      `font-size: ${8 + Math.random() * 14}px`,
      `left: ${Math.random() * 100}%`,
      `animation-duration: ${8 + Math.random() * 14}s`,
      `animation-delay: ${Math.random() * 10}s`,
      'opacity: 0',
    ].join('; ');

    container.appendChild(el);
  }
})();


/* =============================================================
   9. SCROLL-REVEAL ANIMATION
   Watches specific element types with an IntersectionObserver.
   When an element enters the viewport it transitions from its
   "hidden" state (opacity:0, translateY(24px)) to visible.
   Staggered delays (based on DOM order) give a cascade effect.
   Skipped when user prefers reduced motion.
============================================================= */
(function initScrollReveal() {
  if (prefersReducedMotion) return;

  // All element types that should animate in on scroll
  const SELECTORS = [
    '.nft-card',
    '.rarity-card',
    '.team-card',
    '.timeline-item',
    '.trait-chip',
    '.faq-item',
  ].join(', ');

  const elements = qsa(SELECTORS);
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // only animate once
        }
      });
    },
    {
      threshold:  0.10,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elements.forEach((el, index) => {
    // Add base "hidden" class; stagger delay by element index
    el.classList.add('reveal-item');
    el.style.transitionDelay = `${index * 0.06}s`;
    observer.observe(el);
  });
})();


/* =============================================================
   10. RARITY BAR ANIMATION
   Each .rarity-bar has a CSS custom property --pct that holds
   its target width (e.g. "15%"). On scroll-into-view the bar
   animates from 0 to that width.
   Skipped when user prefers reduced motion (CSS already handles
   this, but we skip the observer for cleanliness).
============================================================= */
(function initRarityBars() {
  const bars = qsa('.rarity-bar');
  if (!bars.length) return;

  // If reduced motion, just set final widths immediately
  if (prefersReducedMotion) {
    bars.forEach((bar) => {
      bar.style.width = getComputedStyle(bar).getPropertyValue('--pct').trim();
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Animate to the percentage defined in --pct
          const targetWidth = getComputedStyle(entry.target)
            .getPropertyValue('--pct')
            .trim();
          entry.target.style.width = targetWidth;
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.50 }
  );

  bars.forEach((bar) => {
    bar.style.width = '0'; // ensure starting at 0
    observer.observe(bar);
  });
})();


/* =============================================================
   11. MINT PROGRESS BAR ANIMATION
   Similar to rarity bars: animates from 0 to the inline width
   value when the widget scrolls into view.
============================================================= */
(function initMintProgressBar() {
  const fill = document.querySelector('.mint-progress-fill');
  if (!fill) return;

  // Capture the target width from the inline style set in HTML
  const targetWidth = fill.style.width || '62.48%';

  if (prefersReducedMotion) {
    fill.style.width = targetWidth;
    return;
  }

  // Start at 0 so the animation has a starting point
  fill.style.width = '0';

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Small delay before expanding for visual clarity
          setTimeout(() => { fill.style.width = targetWidth; }, 300);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.50 }
  );

  observer.observe(fill);
})();


/* =============================================================
   12. SMOOTH SCROLL WITH NAVBAR OFFSET
   Native CSS `scroll-behavior: smooth` (set on <html>) handles
   most cases, but we need a JS override to account for the
   fixed navbar height so the target section isn't hidden behind it.
============================================================= */
(function initSmoothScroll() {
  const NAVBAR_HEIGHT = 80; // px — should match the nav container height

  qsa('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function handleClick(e) {
      const href = this.getAttribute('href');

      // Let plain "#" links (e.g. placeholder footer links) behave normally
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      const targetTop = target.getBoundingClientRect().top + window.scrollY - NAVBAR_HEIGHT;

      window.scrollTo({ top: targetTop, behavior: 'smooth' });

      // Move focus to the target section for keyboard / AT users
      // (only if element is focusable or we can make it temporarily focusable)
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener(
          'blur',
          () => target.removeAttribute('tabindex'),
          { once: true }
        );
      }
      target.focus({ preventScroll: true });
    });
  });
})();
