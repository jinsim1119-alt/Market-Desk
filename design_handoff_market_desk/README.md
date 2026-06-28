# Handoff: MARKET DESK — Personal Portfolio Dashboard

## Overview

**MARKET DESK** is a personal-use financial dashboard that aggregates:

1. **8 global market indices/macros** at the top — S&P 500, NASDAQ 100, PHLX Semiconductor, USD/KRW, US 10Y/30Y Treasury yields, KOSPI, KOSDAQ
2. **A configurable portfolio of stocks + ETFs** displayed as cards with daily price, change %, sparkline, and an accurate Wilder RSI(14) bar
3. **CNN Fear & Greed Index** in a half-circle gauge with timeline comparison (yesterday / 1 week / 1 month / 1 year ago) and 7 sub-indicators
4. **A separate Korean semiconductor section** (Samsung Electronics, SK Hynix)

The default portfolio is: SOXL, QLD, NVDA, GOOGL, TSLA, SPCX, TLTW, 473330 (SOL US 30Y Treasury Covered Call synthetic ETF), plus Samsung Electronics (005930) and SK Hynix (000660).

Designed for a **single user** to check **once per day** on a phone (PWA installed to home screen). Data is auto-refreshed every day at 06:00 KST by a GitHub Actions cron, which calls the data sources and commits an updated `data.json` to the repo. The frontend fetches `data.json` on load and caches the last successful payload in `localStorage` for offline fallback.

The visual language is a **Bloomberg-style dark trading terminal** with high information density, monospace numerals (JetBrains Mono), and Korean-convention color semantics (red = up, blue = down) — toggleable to US convention via a Tweaks panel.

## About the Design Files

The files in this bundle are **design references created as a working HTML/React (UMD + Babel-standalone) prototype**. They were built to demonstrate intended look, layout, interactions, and the full data flow including PWA install + automated daily refresh — **not as production code to ship as-is**.

The prototype is fully functional end-to-end (data fetch, RSI computation, PWA offline, GitHub Actions cron), but the React-in-the-browser via Babel-standalone approach is **not appropriate for production**. The task is to **recreate this design in the target codebase's existing environment** — most likely React + Vite or Next.js — using the codebase's established conventions for styling, state management, build tooling, and deployment.

If no environment exists yet, **React + Vite + TypeScript** is the recommended starting point given:
- Single-page app, no routing required
- No server-side rendering needed (data is generated at build time by GitHub Actions)
- PWA setup is well-supported (e.g. `vite-plugin-pwa`)
- TypeScript will tighten the data contract between `scripts/fetch-data.mjs` and the UI

The data layer (`scripts/fetch-data.mjs`) and the GitHub Actions workflows can be **transplanted directly** — they are framework-agnostic Node.js + YAML.

## Fidelity

**High-fidelity (hifi).** All colors, typography, spacing, sizing, and component layout are pixel-finalized. The prototype was iterated against live screenshots and feedback. Reproduce these visuals pixel-perfectly using the target codebase's primitives — do not introduce a different design system.

The Korean-convention color toggle (red↑ / blue↓) is the **default**; the US convention (green↑ / red↓) is a user-toggleable variant via the Tweaks panel. Both must be supported.

## Screens / Views

This is a **single-screen dashboard** (no routing, no separate pages). All content is on one scrollable page divided into vertical sections.

### 1. Header (sticky-ish top bar)

**Purpose:** Branding, live data freshness indicator, current time, and US/KR market open/closed status.

**Layout:**
- Full-width flex row, `space-between` justification
- Left: logo block | divider | meta block
- Right: market status indicators | divider | clock
- Background: `#11151c` (card surface)
- Bottom border: `1px solid rgba(255,255,255,0.06)`
- Padding: `14px 24px` (desktop), `12px 14px` (mobile, with iOS safe-area top padding via `env(safe-area-inset-top)`)

**Components:**
- **Logo**: A 10×10px green square (`#22c55e`) with a soft glow (`box-shadow: 0 0 12px #22c55e88`) animated with a 2.4s pulse (opacity 1 → 0.45 → 1), followed by wordmark "MARKET**DESK**" where "DESK" is green (`#22c55e`). Font: JetBrains Mono, 15px, weight 700, letter-spacing 0.04em.
- **Meta block**: Two stacked lines.
  - Top line: "PORTFOLIO MONITOR" (mono, 9.5px, weight 600, letter-spacing 0.16em, color `#5b6473`), followed inline by a **live-status badge** — one of:
    - `● LIVE` — green (`#22c55e`, bg `rgba(34,197,94,0.15)`, border `rgba(34,197,94,0.35)`)
    - `⟳ SYNC` — blue (`#60a5fa`)
    - `⚠ CACHED` — amber (`#f59e0b`)
    - `⚠ OFFLINE` — red (`#ef4444`)
    - All badges: mono, 9px, weight 700, padding `1px 5px`, radius 2px
  - Bottom line: "8 ASSETS · 4 INDICES · 4 MACRO" (mono, 11px, color `#9aa3b2`)
- **Market status (US & KR)**: For each, a colored dot (7×7px round) + bold label (`US` / `KR`) + detail text. Dot color: `#22c55e` for OPEN (with `box-shadow: 0 0 8px #22c55e88`), `#ef4444` for CLOSED. Label: mono, 11px, weight 700, letter-spacing 0.08em. Detail: mono, 11px, color `#5b6473`.
- **Clock**: Live ticking, right-aligned. Date (mono, 10px, color `#5b6473`): `YYYY.MM.DD (요일)` format, Korean weekday letters (일/월/화/수/목/금/토). Time (mono, 15px, weight 600): `HH:MM:SS` 24h. "KST" suffix in 10px secondary color.
- **Header divider**: 1px wide × 28px tall, color `rgba(255,255,255,0.06)`.

### 2. Index Bar (single row, 8 cells)

**Purpose:** At-a-glance view of all 8 macro indicators.

**Layout:**
- `display: grid; grid-template-columns: repeat(8, 1fr);` on desktop
- Tablet (≤1100px): `repeat(4, 1fr)` two rows
- Mobile (≤700px): `repeat(2, 1fr)` four rows
- Each cell separated by `1px solid rgba(255,255,255,0.06)` right border (last has none)
- Background: `#11151c`
- Bottom border: `1px solid rgba(255,255,255,0.06)`
- Cell padding: `14px 18px`
- Cell hover: background → `#1a1f29` (subtle)

**Each cell contains:**
- **Top row** (label-row): Region tag pill ("US", "FX", "BOND", "KR") + index label, optionally followed by an "EST" tag for estimated values.
  - Region tag: mono 8.5px weight 700, letter-spacing 0.12em, padding `2px 5px`, background `#232936`, color `#9aa3b2`, radius 2px
  - Index label: mono 10.5px weight 600, color `#9aa3b2`, letter-spacing 0.04em, truncated with ellipsis if too long
  - "EST" badge (only on estimated values like Treasury yields): mono 8px weight 700, padding `1px 4px`, background `rgba(245,158,11,0.15)`, color `#f59e0b`, border `1px solid rgba(245,158,11,0.35)`
- **Value row**: Mono 19px weight 600, color `#e8eaed`, letter-spacing -0.01em
  - Bond yields formatted as `X.XXX%`
  - USD/KRW prefixed with `₩`
  - Indices: `9,999.99` with comma separators, 2 decimals
- **Change row**: Inline `▲` or `▼` arrow + absolute change + `(±X.XX%)` in parentheses
  - Color: dynamic based on color convention (see Design Tokens)
  - Mono 11px weight 500

**The 8 cells, in order:**
1. S&P 500 (US) — e.g. 7,354.02 / -3.47 (-0.05%)
2. NASDAQ 100 (US)
3. PHLX 반도체 (US) — Philadelphia Semiconductor Index
4. USD/KRW (FX) — with `₩` prefix
5. 美 10Y (BOND, EST badge) — 10Y Treasury yield as percentage
6. 美 30Y (BOND, EST badge) — 30Y Treasury yield
7. KOSPI (KR)
8. KOSDAQ (KR)

### 3. Main Layout — 2-column grid

**Layout:**
- `display: grid; grid-template-columns: 1fr 380px;` on desktop (≤1400px: `1fr 340px`)
- Mobile (≤1200px): single column, Fear & Greed panel moves to top (`order: -1`)
- Gap: 20px
- Padding: `20px 24px`

**Left column:** Stocks section
**Right column:** Fear & Greed panel

### 4. Stocks Section (left column)

**Section header:**
- Title: "PORTFOLIO" + count badge (e.g. "8") + region tag ("US" — blue: bg `rgba(59,130,246,0.15)`, color `#60a5fa`)
- Title font: mono 12px weight 700, letter-spacing 0.18em, color `#9aa3b2`
- Count badge: 11px, padding `2px 7px`, background `#232936`, color `#e8eaed`, radius 3px
- Right side: meta info — `기준: 2026-06-27 09:00 KST` · `RSI(14) · Wilder` (mono 10.5px, color `#5b6473`)

**Stocks grid:**
- `display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;`
- ≤1500px: `repeat(3, 1fr)`
- ≤1100px: `repeat(2, 1fr)`
- ≤640px: single column

#### Stock Card (the centerpiece component)

Each card represents one stock/ETF. Approximately 280-320px wide × 480px tall on desktop.

- Background: `#11151c`
- Border: `1px solid rgba(255,255,255,0.06)` (hover → `rgba(255,255,255,0.12)`, `transform: translateY(-1px)`, transition 0.18s)
- Border-radius: 8px
- Padding: 16px
- Internal vertical gap: 14px
- **Left accent bar** (via `::before` pseudo-element): 3px wide, full height, color depends on `data-up`/`data-down` attribute — green if change>0, red if change<0, gray (`#3a4150`) if flat. (Color flips based on color convention.)

**Card sections (top to bottom):**

1. **Header row** (`flex space-between`):
   - **Ticker block** (left, vertical):
     - **Ticker symbol** (mono 16px weight 700, color `#e8eaed`) + inline **badges**:
       - `2x` / `3x` for leveraged ETFs (purple: bg `rgba(168,85,247,0.15)`, color `#c084fc`, border `rgba(168,85,247,0.35)`)
       - `ETF` for non-leveraged ETFs (blue: same blue palette as US tag)
       - `IPO` for newly listed (amber, with a 2.4s pulse animation that adds a `box-shadow: 0 0 0 3px rgba(245,158,11,0.12)` at peak)
     - **Name row** (below ticker): Korean name (Pretendard 12px weight 500, color `#9aa3b2`, ellipsis) + exchange tag (mono 8.5px, padding `1px 4px`, border `1px solid rgba(255,255,255,0.12)`, color `#5b6473`, e.g. "NASDAQ", "AMEX", "KOSPI")
   - **Day change pill** (right): Rounded pill with arrow + change %. Colored using the stock's change color: `color`, `background: ${color}14`, `border: 1px solid ${color}40`. Mono 12px weight 600. Padding `4px 8px`.

2. **Price block** (`flex` baseline-aligned):
   - **Main price** (mono, `clamp(18px, 1.6vw + 8px, 24px)`, weight 700, color `#e8eaed`, letter-spacing -0.02em). Format: USD as `$XXX.XX`, KRW as `₩XXX,XXX` (no decimals, ko-KR locale comma grouping).
   - **Absolute change** (mono 12px weight 500, color = up/down color): `+X.XX USD` or `+XXX 원`.

3. **Sparkline block**:
   - 18-day closing-price line chart (SVG, full card width, ~56px tall)
   - Stroke color matches change color, stroke-width 1.5px, rounded line cap/join
   - Area fill: linear vertical gradient from `${color}52` (32% alpha) at top to `${color}00` (0% alpha) at bottom
   - X-axis labels (mono 8.5px, color `#5b6473`): "10거래일 전" left, "06.26 종가" right (date dynamic)

4. **RSI(14) bar**:
   - **Header row**:
     - Label "RSI" (mono 9.5px weight 700, letter-spacing 0.1em, color `#5b6473`) + "(14)" suffix (weight 400, opacity 0.8)
     - Value (mono 13px weight 700) — color shifts: amber `#f59e0b` if ≥70, violet `#a78bfa` if ≤30, white `#e8eaed` if neutral
     - Zone label on right ("과매수" / "Neutral" / "과매도" / "데이터 누적 중") — same color as value, mono 9.5px weight 600
   - **Track**: 8px tall, `background: #1a1f29`, radius 2px, positioned relative.
     - **Background zones** (absolute, opacity 0.18): Oversold (left 0-30%): violet `#a78bfa`. Overbought (right 70-100%): amber `#f59e0b`.
     - **Fill**: From 0 to `${value}%`. Uses a sectioned gradient: violet 0-30%, blue 30-70%, amber 70-100% (achieved with `background-size: 333% 100%; background-position: left center;` on a 3-stop gradient — so the same fill renders different colors at different widths).
     - **Marker line**: 2px white vertical line at the exact value position, with `box-shadow: 0 0 4px rgba(255,255,255,0.4)`.
     - **Threshold lines**: 1px vertical lines at 30% and 70% (`rgba(255,255,255,0.18)`).
   - **Scale labels** (below track): `0` `30` `50` `70` `100` positioned absolutely at corresponding percentages (mono 8.5px, color `#3a4150`).
   - **N/A state** (when RSI cannot be computed, e.g. SPCX has <14 trading days): Single-line "데이터 누적 중" centered on a 28px-tall track placeholder.

5. **Metrics grid** (only when `density === 'comfortable'`):
   - 2-column grid, 1px gap, 4px radius, overflow hidden, with the gap rendered via background color (`background: var(--border)` on the grid, each cell on `var(--bg-1)`).
   - Each cell is a `flex space-between baseline` row with:
     - Label (mono 9px weight 600, letter-spacing 0.08em, color `#5b6473`)
     - Value (mono 10.5px weight 500, color `#e8eaed`)
   - **6 cells**, adapting to data availability:
     - If `week52High`/`week52Low` present: cells 1-2 show those. Else: `1M 수익` and `1Y 수익` (with color: green if positive, red if negative).
     - Cell 3: `거래량` (volume — formatted as `52.0M`, `1.1B`, `0.39M`, etc.)
     - Cell 4: `시총` (market cap — formatted as `$4.66T`, `1,984.8조`, etc.)
     - Cell 5: `PER` if present; else `배당률` (in amber) if `dividendYield`; else `PER N/A`
     - Cell 6: `외인` (foreign holding %) if available (Korean stocks); else `전일종가` (previous close)

### 5. Korean Semiconductor Section

After the main stocks grid, a second section "KR 반도체" with a red `KR` tag (bg `rgba(239,68,68,0.15)`, color `#f87171`). Same StockCard component, but the grid uses `repeat(2, 1fr)` (since only 2 stocks: Samsung 005930, SK Hynix 000660). Section header has `margin-top: 24px`. Right meta: just "KOSPI".

### 6. Fear & Greed Panel (right column)

**Layout:**
- Background `#11151c`, border `1px solid rgba(255,255,255,0.06)`, radius 8px, padding 18px
- Vertical flex with 18px gap

**Header:**
- Title "FEAR & GREED INDEX" (mono 12px weight 700, letter-spacing 0.16em, color `#e8eaed`)
- Subtitle "CNN Business · 시장 심리 지표" (Pretendard 11px, color `#5b6473`)
- Border-bottom: `1px solid rgba(255,255,255,0.06)`, padding-bottom 12px

**Half-circle gauge (SVG, viewBox `0 0 300 200`):**
- Center at (150, 150), radius 110
- Drawn as 5 arc segments (180° total, 0° = right "greedy", 180° = left "fearful"):
  - 0-25 (Extreme Fear): `#dc2626`
  - 25-45 (Fear): `#f97316`
  - 45-55 (Neutral): `#eab308`
  - 55-75 (Greed): `#84cc16`
  - 75-100 (Extreme Greed): `#22c55e`
- Stroke width 18, opacity 1 for the segment containing the current value, 0.22 for the others
- Tick marks at 0/25/50/75/100 (1px gray lines, `#5b6473`)
- Needle: 2.5px white line (`#e8eaed`) from center to value position, with a round cap. Center hub: 7px radius circle, fill `#0a0d12`, 2px white stroke.
- "0" label at bottom-left (mono 10px, color `#5b6473`), "100" at bottom-right
- **Center stat** (absolutely positioned, centered, 18px from bottom):
  - Value (mono 46px weight 700, color from gauge palette based on value range, line-height 0.9)
  - Label (mono 11px weight 700, uppercase, letter-spacing 0.18em, same color)

**Timeline (4 rows):**
- Border-top + border-bottom: `1px solid rgba(255,255,255,0.06)`, padding 12px vertical
- Each row: `grid-template-columns: 70px 1fr 32px`, 10px gap, mono
  - Label (10px, color `#5b6473`): "전일" / "1주 전" / "1개월 전" / "1년 전"
  - Progress bar (6px tall, bg `#1a1f29`, radius 2px) with a fill colored per the gauge palette
  - Value (11px weight 600, color `#e8eaed`, right-aligned)

**Components (7 sub-indicators):**
- Header "7개 세부 지표" (mono 10px weight 600, letter-spacing 0.14em, color `#5b6473`)
- 7 rows, each `grid-template-columns: 1fr 60px 28px`, 8px gap:
  - Left: Name (mono 10.5px weight 600, color `#e8eaed`) over description (Pretendard 9.5px, color `#5b6473`, truncated)
  - Middle: 4px tall progress bar with palette-colored fill at `${value}%`
  - Right: Value (mono 10.5px weight 600, color `#e8eaed`, right-aligned)

The 7 indicators (names + descriptions):
1. **Market Momentum** — S&P 500 vs 125일 이평선
2. **Stock Price Strength** — 52주 신고가/신저가
3. **Stock Price Breadth** — McClellan Volume Summation
4. **Put/Call Options** — 5일 평균 풋콜 비율
5. **Market Volatility** — VIX 및 50일 이평
6. **Safe Haven Demand** — 주식 vs 채권 20일 수익률
7. **Junk Bond Demand** — 투자등급-정크본드 스프레드

### 7. Footer

- Two-line layout: Left — `출처: ${source} · 기준: ${asOf} · ※ 美 채권금리는 추정값(EST)`. Right — `MARKETDESK v1.1`.
- On mobile: column layout, gap 4px, with iOS bottom safe-area padding.
- Background: `#11151c`. Top border: `1px solid rgba(255,255,255,0.06)`. Padding: `14px 24px`.
- Font: mono 10px, color `#5b6473`.

### 8. Tweaks Panel (floating control panel, bottom-right)

User-togglable settings panel. Hidden by default; toggled via a host-controlled mechanism (in production, this could be a settings gear icon button in the header). When open, shows:

- **외관** (Appearance) section:
  - **테마**: Radio dark / light
  - **등락 색상**: Radio "美 ↑녹 ↓적" (US convention) / "韓 ↑적 ↓청" (KR convention) — **default: KR**
  - **정보 밀도**: Radio Compact / Comfort — **default: Comfort**
- **정렬** (Sort) section:
  - **종목 정렬**: Select with options "기본 순서", "등락률 ↓", "RSI ↓", "가나다순"

Selected values persist to `localStorage` (or wherever the target codebase persists user prefs).

## Interactions & Behavior

### Data Loading

On page load:
1. Render immediately with bundled fallback data (synchronously available)
2. Fire `fetch('data.json?_=' + Date.now())` (cache-bust query) in a `useEffect`
3. While loading: header shows `⟳ SYNC` badge (blue)
4. On success: replace state with fetched data, badge → `● LIVE` (green), and cache the JSON in `localStorage` under key `marketdesk:lastData`
5. On failure: read from `localStorage` cache; if present, badge → `⚠ CACHED` (amber); if no cache available, badge → `⚠ OFFLINE` (red) and bundled fallback remains

### Clock

Update every 1000ms via `setInterval` cleared in `useEffect` cleanup.

### Sort

When the "종목 정렬" tweak changes, re-sort `data.stocks` in-place (clone first). Sort modes:
- `default`: original array order
- `change-desc`: sort by `changePct` descending
- `rsi-desc`: sort by `rsi` descending (nulls last)
- `name`: `localeCompare('ko')` ascending

### Color Convention

A `useColors(convention)` hook returns `{ up, down, flat }` colors. All up/down color decisions (card border accent, change pill, sparkline stroke, gradient fill, change row text) must read from this hook — never hard-code green/red.

### Hover States

- Stock card: border lightens, `translateY(-1px)`, transition 0.18s
- Index cell: background `#11151c` → `#1a1f29`, transition 0.15s

### Animations

- Logo dot: 2.4s pulse (`opacity 1 → 0.45 → 1`)
- IPO badge: 2.4s glow ring pulse (`box-shadow 0 → 0 0 3px rgba(245,158,11,0.12) → 0`)
- No other animations. Avoid adding any.

### Responsive Breakpoints

- ≥1500px: 4-col stocks grid
- 1200-1499px: 3-col stocks grid, F&G panel stays right
- 1100-1199px: 3-col stocks grid, F&G panel **moves above** stocks (mobile-like main layout)
- 700-1099px: 2-col stocks grid, 4-col index bar (2 rows)
- ≤700px (mobile/PWA): 1-col stocks grid, 2-col index bar (4 rows), header switches to column layout, smaller fonts, tighter padding, iOS safe-area handling at top/bottom

### PWA Behavior

- `apple-mobile-web-app-capable` — enables full-screen on iOS
- `viewport-fit=cover` + `env(safe-area-inset-*)` — handles notch and home indicator
- Service Worker (`sw.js`): cache-first for static assets, network-first for `data.json` with cache fallback
- Manifest declares `display: standalone`, theme color `#0a0d12`
- Bundled icons: 32, 180 (apple-touch), 192, 512, 512-maskable

## State Management

Minimal — no global state library needed. All state is local to the root component:

```ts
const [theme, setTheme] = useState<'dark' | 'light'>('dark');
const [colorConvention, setColorConvention] = useState<'us' | 'kr'>('kr');
const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
const [sortBy, setSortBy] = useState<'default' | 'change-desc' | 'rsi-desc' | 'name'>('default');
const [data, setData] = useState<MarketData | null>(bundledFallback);
const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ok' | 'cached' | 'fallback'>('idle');
```

Persist user-prefs (theme, colorConvention, density, sortBy) to `localStorage`. Persist `lastData` to `localStorage` for offline fallback.

### Data Contract (`data.json`)

```ts
interface MarketData {
  meta: {
    asOf: string;              // "2026-06-27 09:00 KST"
    generatedAt: string;        // ISO timestamp
    source: string;
    marketStatus: {
      us: { label: 'OPEN' | 'CLOSED'; detail: string };
      kr: { label: 'OPEN' | 'CLOSED'; detail: string };
    };
  };
  indices: Array<{
    id: 'spx' | 'ndx' | 'sox' | 'usdkrw' | 'ust10' | 'ust30' | 'kospi' | 'kosdaq';
    label: string;
    value: number;
    change: number;
    changePct: number;
    region: 'US' | 'KR' | 'FX' | 'BOND';
    unit?: '%' | '₩';
    estimated?: boolean;        // shows EST badge
  }>;
  fearGreed: {
    value: number;              // 0-100, rounded
    valueExact: number;         // 2-decimal raw
    label: string;              // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
    asOf: string;
    previous: { yesterday: number; weekAgo: number; monthAgo: number; yearAgo: number };
    components: Array<{
      name: string;
      desc: string;
      value: number;
      label: string;
    }>;                          // length 7
  };
  stocks: Stock[];               // length 8 in default config
  krStocks: Stock[];             // length 2
}

interface Stock {
  ticker: string;
  nameKr: string;
  exchange: string;
  currency: 'USD' | 'KRW';
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  week52High?: number | null;
  week52Low?: number | null;
  volume: string;                // pre-formatted: "52.0M", "1.1B", "0.39M"
  marketCap?: string;            // pre-formatted: "$4.66T", "1,984.8조"
  per?: number | null;
  eps?: number;
  pbr?: number;
  dividendYield?: number | null; // percent, e.g. 12.19 means 12.19%
  rsi: number | null;            // null when <14 days of data
  sparkline: number[];           // last 18 closing prices, oldest first
  return1M?: number;             // for ETFs without 52W H/L
  return3M?: number;
  return1Y?: number;
  navPrem?: number;              // 괴리율 for ETFs
  foreignRate?: number;          // Korean stocks
  isETF?: boolean;
  isLeveraged?: '2x' | '3x';
  isNewlyListed?: boolean;
  ipoDate?: string;
  ipoPrice?: number;
  ndx100Inclusion?: string;
  latestDate?: string;           // "20260626"
}
```

### Data Fetching Pipeline (`scripts/fetch-data.mjs`)

Runs on GitHub Actions cron daily at 21:00 UTC (06:00 KST next day). Process:

1. Fetch each index via Yahoo Finance: `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
2. Fetch each stock's 90-day time series from `https://api.stock.naver.com/chart/${market}/item/${symbol}/day?startDateTime=${start}&endDateTime=${end}` where `market` is `foreign` or `domestic`
3. Compute RSI(14) using **Wilder's smoothing** (not simple moving average — see formula in `calcRSI` function in the source)
4. Fetch CNN Fear & Greed from `https://production.dataviz.cnn.io/index/fearandgreed/graphdata`
5. Estimate 7 F&G sub-components by perturbing the overall score by ±10 with a deterministic seed (CNN's sub-component values are not exposed in the JSON endpoint)
6. Write `data.json` to repo root
7. GitHub Actions step commits and pushes if `data.json` changed, then triggers Pages deploy

## Design Tokens

### Color Palette (Dark Theme — Default)

| Token | Hex | Usage |
|---|---|---|
| `--bg-0` | `#0a0d12` | Page background |
| `--bg-1` | `#11151c` | Card / surface |
| `--bg-2` | `#1a1f29` | Hover / RSI track |
| `--bg-3` | `#232936` | Region tags, count badges |
| `--border` | `rgba(255,255,255,0.06)` | Default borders, dividers |
| `--border-strong` | `rgba(255,255,255,0.12)` | Hover borders, exchange tag |
| `--text-1` | `#e8eaed` | Primary text, numbers |
| `--text-2` | `#9aa3b2` | Secondary text |
| `--text-3` | `#5b6473` | Tertiary text, labels |
| `--text-4` | `#3a4150` | Quaternary, scale labels |
| `--accent` | `#3b82f6` | Generic accent / RSI middle band |
| `--warning` | `#f59e0b` | Estimated, IPO, dividend yield |

### Light Theme

| Token | Hex |
|---|---|
| `--bg-0` | `#f5f6f8` |
| `--bg-1` | `#ffffff` |
| `--bg-2` | `#eef0f3` |
| `--bg-3` | `#e1e4ea` |
| `--border` | `rgba(0,0,0,0.08)` |
| `--border-strong` | `rgba(0,0,0,0.16)` |
| `--text-1` | `#0a0d12` |
| `--text-2` | `#4a5568` |
| `--text-3` | `#6b7280` |
| `--text-4` | `#9aa3b2` |
| `--rsi-track` | `#e1e4ea` |

### Semantic Colors (color-convention-aware)

| Token | KR convention (default) | US convention |
|---|---|---|
| Up | `#ef4444` (red) | `#22c55e` (green) |
| Down | `#3b82f6` (blue) | `#ef4444` (red) |
| Flat | `#9aa3b2` | `#9aa3b2` |

### Fear & Greed Palette

| Range | Color | Label |
|---|---|---|
| 0-25 | `#dc2626` | Extreme Fear |
| 25-45 | `#f97316` | Fear |
| 45-55 | `#eab308` | Neutral |
| 55-75 | `#84cc16` | Greed |
| 75-100 | `#22c55e` | Extreme Greed |

### RSI Zone Colors

| Range | Color | Label |
|---|---|---|
| 0-30 | `#a78bfa` (violet) | 과매도 (Oversold) |
| 30-70 | `#3b82f6` (blue) | Neutral |
| 70-100 | `#f59e0b` (amber) | 과매수 (Overbought) |

### Badge Colors

| Badge | Background | Text | Border |
|---|---|---|---|
| LIVE / OPEN | `rgba(34,197,94,0.15)` | `#22c55e` | `rgba(34,197,94,0.35)` |
| SYNC / blue tag (US) / accent | `rgba(59,130,246,0.15)` | `#60a5fa` | `rgba(59,130,246,0.30)` |
| CACHED / EST / IPO / amber | `rgba(245,158,11,0.15)` | `#f59e0b` (or `#fbbf24`) | `rgba(245,158,11,0.35)` |
| OFFLINE / red tag (KR) | `rgba(239,68,68,0.15)` | `#ef4444` or `#f87171` | `rgba(239,68,68,0.30)` |
| Leveraged (2x/3x) | `rgba(168,85,247,0.15)` | `#c084fc` | `rgba(168,85,247,0.35)` |

### Typography

- **Sans / Korean**: Pretendard (weights 400, 500, 600, 700, 800) — loaded from Google Fonts
- **Monospace**: JetBrains Mono (weights 400, 500, 600, 700) — loaded from Google Fonts
- Body base: 14px, line-height 1.4
- All numerical values (prices, changes, RSI, indices, clock) use the mono stack
- All Korean labels and stock names use the sans stack
- Mix freely within a single line — no `font-feature-settings` tweaks needed

### Spacing Scale (no formal scale, but consistent usage)

- 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24px — used throughout
- Card padding: 16px desktop, 12px mobile
- Section padding: 20px 24px desktop, 12px mobile
- Inter-card gap: 14px desktop, 10px mobile

### Border Radius

- Cards: 8px
- Pills (day change): 4px
- Badges, region tags: 2px
- Bars (RSI track, timeline bars): 2px

### Shadows / Glows

- Logo dot: `box-shadow: 0 0 12px #22c55e88`
- Status dot (open): `box-shadow: 0 0 8px #22c55e88`
- RSI marker: `box-shadow: 0 0 4px rgba(255,255,255,0.4)`
- IPO badge animated: `box-shadow: 0 0 0 3px rgba(245,158,11,0.12)` at peak
- No general elevation shadows on cards — bordered surfaces only

## Assets

### Generated by the prototype

- `icons/icon-192.png` (192×192) — PWA standard
- `icons/icon-512.png` (512×512) — PWA standard
- `icons/icon-maskable-512.png` (512×512) — Android adaptive icon with 80% safe-area
- `icons/apple-touch-icon.png` (180×180) — iOS home screen
- `icons/favicon-32.png` (32×32) — browser tab

All icons are dark (`#0a0d12`) backgrounds with a green accent square (top-left), large "MD" monogram (centered), and a green accent line below "MD". Regenerable via the canvas-drawing script in `scripts/` (was created with `run_script` in the design tool; equivalent canvas/Node-canvas code can be added to the build pipeline if icons need to be themed differently per environment).

### External assets

- **Fonts**: Pretendard + JetBrains Mono via Google Fonts CDN. In production, host self-hosted with `font-display: swap` to avoid CLS.
- **React + ReactDOM + Babel-standalone**: loaded via unpkg in the prototype. **Remove these and use the target codebase's bundler** (Vite, Next.js, etc.).

### Data sources (no static assets, but operational dependencies)

- **Yahoo Finance** (`query1.finance.yahoo.com`) — unofficial public endpoint for indices
- **Naver Pay Securities API** (`api.stock.naver.com`) — unofficial endpoint for Korean and US stock OHLCV
- **CNN Business Fear & Greed** (`production.dataviz.cnn.io/index/fearandgreed/graphdata`) — unofficial public endpoint

All three are unofficial and could be rate-limited or change format. The fetch script should fail gracefully per-symbol and produce partial `data.json` rather than abort.

## Files

In this handoff bundle, under `design_handoff_market_desk/`:

- `index.html` — entry HTML, declares manifest, theme color, robots noindex, loads scripts
- `styles.css` — all CSS, organized by section (header, index bar, main layout, stock card, RSI bar, F&G panel, footer, responsive)
- `app.jsx` — root React component, data fetch, sorting, layout composition
- `components.jsx` — `DashboardHeader`, `IndexBar`, `Sparkline`, `RSIBar`, `StockCard`, `FearGreedGauge`, helper functions `useColors`, `getChangeColor`, formatting utilities
- `tweaks_panel.jsx` — the floating settings panel and its `useTweaks` hook + `TweakSection`, `TweakRadio`, `TweakSelect` controls. This was copied from a starter — adapt to the target codebase's preferred form-control patterns.
- `data.json` — example payload showing the exact data contract
- `data.js` — bundled fallback (same data, but in a `window.MARKET_DATA = {...}` IIFE for offline-first rendering before fetch resolves)
- `manifest.webmanifest` — PWA manifest
- `sw.js` — Service Worker (cache-first static, network-first data)
- `robots.txt` — disallow all crawlers
- `scripts/fetch-data.mjs` — the data fetcher; runs in Node 20, no external deps (uses built-in `fetch`)
- `.github/workflows/daily-update.yml` — GitHub Actions cron `0 21 * * *` (UTC) = 06:00 KST
- `.github/workflows/deploy-pages.yml` — push-triggered Pages deploy
- `README.md` — end-user setup guide (separate from this handoff doc — that one targets the *operator* of the dashboard, this one targets the *developer* implementing it)

## Notes for the Developer

1. **The RSI calculation must use Wilder's smoothing**, not simple moving average. The formula is in `calcRSI()` inside `scripts/fetch-data.mjs` and was independently verified to match TradingView's RSI(14) output to within 0.1.

2. **Treasury yield "EST" badge** exists because Naver doesn't expose Treasury yields cleanly; Yahoo's `^TNX` (10Y) and `^TYX` (30Y) work but are sometimes 1-day stale. Keep the badge.

3. **SPCX is special** — it IPO'd 2026-06-12, so 14-day RSI is not computable until ~2026-07-02. The card must gracefully show "데이터 누적 중" (data accumulating). The `IPO` badge with the pulse animation is intended to communicate this.

4. **The Fear & Greed 7 sub-components are estimated**, not authoritative. CNN's JSON endpoint only returns the overall score. If the developer can find an official sub-component API, replace `estimateComponents()` with real values.

5. **Color convention defaults to Korean** (red up / blue down) per user preference, not US. This is configurable but the default matters.

6. **Korean stock prices use `₩` prefix with ko-KR locale comma grouping** (e.g. `₩2,673,000`), no decimals. USD uses `$` prefix with 2 decimals. The price font auto-scales via `clamp(18px, 1.6vw + 8px, 24px)` to handle 6+ digit Korean prices without overflow.

7. **Service Worker version key** (`VERSION = 'v1.0.0'`) must be bumped on every deploy to invalidate old caches, OR migrate to a build-tool-injected hash. Otherwise iOS sticks to stale assets.

8. **GitHub Actions cron is delayed by 5-15 min** typically. Don't promise "06:00 sharp" to the end user — "around 06:00 KST" is honest.

9. **`viewport-fit=cover` + safe-area-inset CSS** is required for proper iOS standalone PWA chrome. Don't drop these.

10. **Data freshness badge in the header** (`LIVE` / `CACHED` / `OFFLINE`) is **non-negotiable UX** — it tells the user whether they're looking at fresh data or stale cache, which matters for an investing dashboard.

---

⚠️ This is an **investment-reference tool**, not an advisory or trading platform. All disclaimers about "참고용" in the footer must be preserved.
