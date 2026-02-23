# Rare Pigeons Website

Clone of rarepigeons.com.

## Setup — Add Your Pigeon Images

Place your 5 pigeon images inside the `images/` folder with these exact filenames:

| File | Used for |
|------|----------|
| `images/pigeon1.png` | Hero main card, About stack, Legendary rarity, Team card 1, NFT #0001 |
| `images/pigeon2.png` | Hero left card, Epic rarity, Team card 2, NFT #0042 |
| `images/pigeon3.png` | Hero right card, Rare rarity, Team card 3, NFT #0117 |
| `images/pigeon4.png` | About stack, Uncommon rarity, Team card 4, NFT #0253 |
| `images/pigeon5.png` | About stack, Common rarity, NFT #0512 |

Images can be `.png`, `.jpg`, or `.webp` — just update the extensions in `index.html` if needed.

## Structure

```
rarepigeons/
├── index.html    # Main HTML
├── styles.css    # All CSS styles
├── script.js     # JavaScript (FAQ, mint widget, animations)
└── images/       # Put your pigeon images here
    ├── pigeon1.png
    ├── pigeon2.png
    ├── pigeon3.png
    ├── pigeon4.png
    └── pigeon5.png
```

## Sections

- **Navbar** — Fixed with mobile hamburger menu
- **Hero** — Title, stats, CTA buttons, 3-card showcase
- **Ticker** — Scrolling marquee banner
- **About** — Stacked card + feature list
- **Collection** — 6-card NFT grid
- **Rarity** — 5-tier rarity system with animated bars
- **Traits** — Trait category chips
- **Mint** — Live minting widget with quantity selector
- **Roadmap** — 4-phase timeline
- **Team** — 4-member team grid
- **FAQ** — Accordion Q&A
- **CTA** — Community join section
- **Footer** — Full footer with links
