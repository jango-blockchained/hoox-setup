# Brand graphics

Official mark only (no “HOOX” wordmark). Visual language matches [hoox.sh](https://hoox.sh): flat fields, micro-grid, mono noise, soft outline glow, IBM Plex Mono for type.

## Scripts

| Script                                           | Purpose                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| [`generate-centered.py`](./generate-centered.py) | **First-kit style**: centered logo banners & icons |
| [`generate-taglines.py`](./generate-taglines.py) | **Curated** corner taglines only                   |

```bash
# centered logos (SVG)
python3 brand/generate-centered.py
python3 brand/generate-centered.py --raster   # + PNG

# taglines (small set)
python3 brand/generate-taglines.py --clean
python3 brand/generate-taglines.py --raster
```

---

## 1. Centered logo kit (`generate-centered.py`)

Cool, useful, no spam.

| Asset                                   | Size      | Notes                |
| --------------------------------------- | --------- | -------------------- |
| `og-1200x630-{dark,orange,white}`       | 1200×630  | Open Graph           |
| `twitter-header-1500x500-*`             | 1500×500  | X header             |
| `linkedin-banner-1584x396-*`            | 1584×396  | LinkedIn             |
| `github-social-1280x640-*`              | 1280×640  | GitHub               |
| `blog-hero-1600x900-*`                  | 1600×900  | Blog / docs          |
| `youtube-channel-2560x1440-*`           | 2560×1440 | YouTube              |
| `discord-banner-960x540-*`              | 960×540   | Discord              |
| `email-header-600x200-*`                | 600×200   | Email                |
| `profile-1024-*` / `profile-512-*`      | square    | Avatar               |
| `app-icon-512-*` / `app-icon-192-*`     | square    | App icon             |
| `slack-500-*`                           | 500²      | Slack                |
| `wallpaper-1920x1080-*` / `2560x1440-*` | desktop   | Watermark-scale mark |
| `mark-*-transparent-1024`               | 1024²     | Overlay marks        |

**Colors:** `dark` `#050505` · `orange` `#F97316` · `white` `#FAFAFA`

**Not included:** 1:1 taglines with corner logo+copy.

---

## 2. Taglines (`generate-taglines.py`) — curated only

| Keep                            | Why                        |
| ------------------------------- | -------------------------- |
| **br-bottom** dark/white/orange | Best default social layout |
| **br-split** dark/white         | Opposite-corner editorial  |

All tagline type is **always UPPERCASE**.

| Dropped                                 | Why                                 |
| --------------------------------------- | ----------------------------------- |
| Sentence-case / separate `-upper` files | Always uppercase now                |
| All `tl`/`tr`/`bl` clusters             | Redundant; BR is the strong corner  |
| `top` / `center` valign                 | Subtle; bottom is the clear default |
| Orange split                            | Less needed                         |
| Email / Discord / story / 1:1           | Weak or redundant formats           |

**Copy (always UPPERCASE):**

1. DISTRIBUTED BY DESIGN.
2. FAILURE IS LOCAL. RESILIENCE IS GLOBAL.
3. FASTER. EVERYWHERE.

**Sizes:** OG, Twitter, LinkedIn, GitHub, blog, YouTube only.

```text
tagline-{slug}-{size}-br-bottom-{dark|white|orange}.png
tagline-{slug}-{size}-br-split-{dark|white}.png
```

≈ **90** tagline SVGs (3 slogans × 6 sizes × 5 color/layout combos).

---

## Visual rules

1. No product name letters in assets.
2. ≤2 corner brackets.
3. Flat bg; mono noise; white (or black-on-light) edge glow.
4. Tagline type: IBM Plex Mono.
5. Source mark: `logo/light.svg` geometry.
