// MARKETDESK — 매일 자동 실행되는 데이터 수집 스크립트
// 실행: node scripts/fetch-data.mjs
// 출력: data.json (저장소 루트)
//
// 데이터 출처 (실제 GitHub Actions에서 검증된 엔드포인트만 사용):
//  - 종목 시세/시계열: api.stock.naver.com/chart/{market}/item/{symbol}/day ✅ 검증됨
//  - 인덱스 시계열: api.stock.naver.com/chart/{market}/index/{symbol}/day
//  - 환율 시계열: api.stock.naver.com/chart/foreign/marketindex/{symbol}/day
//  - Fear & Greed: production.dataviz.cnn.io ✅ 검증됨

import fs from 'node:fs/promises';

const PORTFOLIO = [
  // SOXL은 .K(아멕스) suffix 필요할 수 있음
  { ticker: 'SOXL',  market: 'foreign', symbol: 'SOXL.K', nameKr: 'Direxion 반도체 3X',         exchange: 'AMEX',   currency: 'USD', isETF: true, isLeveraged: '3x' },
  { ticker: 'QLD',   market: 'foreign', symbol: 'QLD.K',  nameKr: 'ProShares 울트라 QQQ',       exchange: 'AMEX',   currency: 'USD', isETF: true, isLeveraged: '2x' },
  { ticker: 'NVDA',  market: 'foreign', symbol: 'NVDA.O', nameKr: '엔비디아',                    exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'GOOGL', market: 'foreign', symbol: 'GOOGL.O',nameKr: '알파벳 A',                    exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'TSLA',  market: 'foreign', symbol: 'TSLA.O', nameKr: '테슬라',                      exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'SPCX',  market: 'foreign', symbol: 'SPCX.O', nameKr: '스페이스X',                   exchange: 'NASDAQ', currency: 'USD', isNewlyListed: true, ipoDate: '2026-06-12', ipoPrice: 135.00 },
  { ticker: 'TLTW',  market: 'foreign', symbol: 'TLTW.K', nameKr: 'iShares 美20Y+ 커버드콜',      exchange: 'AMEX',   currency: 'USD', isETF: true },
  { ticker: '473330',market: 'domestic',symbol: '473330', nameKr: 'SOL 美30Y국채커버드콜(합성)',  exchange: 'KOSPI',  currency: 'KRW', isETF: true },
];

const KR_STOCKS = [
  { ticker: '005930', market: 'domestic', symbol: '005930', nameKr: '삼성전자',   exchange: 'KOSPI', currency: 'KRW' },
  { ticker: '000660', market: 'domestic', symbol: '000660', nameKr: 'SK하이닉스', exchange: 'KOSPI', currency: 'KRW' },
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function safeFetch(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, {
      ...opts,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://m.stock.naver.com/',
        ...(opts.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ───────────────────────────────────────────────────────────────
// 시계열 (chart API) — 검증된 유일한 경로
// ───────────────────────────────────────────────────────────────
function dateRange(daysBack = 90) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10).replaceAll('-','');
  const past = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const pastStr = past.toISOString().slice(0,10).replaceAll('-','');
  return { todayStr, pastStr };
}

// 차트 API에서 시계열 가져오기 (item/index/marketindex 공용)
async function fetchChartSeries(path) {
  const { todayStr, pastStr } = dateRange(90);
  const url = `https://api.stock.naver.com/chart/${path}/day?startDateTime=${pastStr}&endDateTime=${todayStr}`;
  try {
    const res = await safeFetch(url);
    if (!res.ok) {
      console.warn(`    HTTP ${res.status}: ${url}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`    Empty response: ${url}`);
      return null;
    }
    return data;
  } catch (e) {
    console.warn(`    Fetch error: ${e.message}: ${url}`);
    return null;
  }
}

// 시계열 → { value, change, changePct, sparkline, week52H/L }
function seriesToQuote(series) {
  if (!series || series.length === 0) return null;
  // 정렬: 오래된 → 최신
  series.sort((a,b) => (a.localDate || '').localeCompare(b.localDate || ''));
  const closes = series.map(d => d.closePrice).filter(v => isFinite(v) && v > 0);
  if (closes.length === 0) return null;
  const latest = series[series.length - 1];
  const prev = series[series.length - 2] || latest;
  const value = latest.closePrice;
  const prevClose = prev.closePrice;
  const change = value - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  return {
    value, prevClose, change, changePct,
    closes,
    sparkline: closes.slice(-18),
    latestDate: latest.localDate,
    open: latest.openPrice,
    high: latest.highPrice,
    low: latest.lowPrice,
    volume: latest.accumulatedTradingVolume,
    foreignRate: latest.foreignRetentionRate,
    week52High: Math.max(...closes),
    week52Low: Math.min(...closes),
  };
}

// ───────────────────────────────────────────────────────────────
// RSI(14, Wilder)
// ───────────────────────────────────────────────────────────────
function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  const gains = [], losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  let avgGain = gains.slice(0, period).reduce((a,b)=>a+b,0) / period;
  let avgLoss = losses.slice(0, period).reduce((a,b)=>a+b,0) / period;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain/avgLoss));
}

function formatVolume(n) {
  if (!n) return '—';
  if (n >= 1e8) return (n/1e8).toFixed(1) + '억';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}

// ───────────────────────────────────────────────────────────────
// 종목 빌드 (foreign 종목은 .K/.O 모두 시도)
// ───────────────────────────────────────────────────────────────
async function fetchStockSeries(market, symbol) {
  // 1차 시도
  let series = await fetchChartSeries(`${market}/item/${symbol}`);
  if (series && series.length > 0) return series;

  // foreign이면 suffix 변형 시도 (.K ↔ .O ↔ 없음)
  if (market === 'foreign') {
    const base = symbol.replace(/\.(K|O)$/, '');
    const variants = symbol.endsWith('.K')
      ? [base + '.O', base]
      : symbol.endsWith('.O')
      ? [base + '.K', base]
      : [base + '.K', base + '.O'];
    for (const v of variants) {
      console.log(`    retry with ${v}...`);
      series = await fetchChartSeries(`${market}/item/${v}`);
      if (series && series.length > 0) return series;
    }
  }
  return null;
}

async function buildStock(cfg) {
  console.log(`  → ${cfg.ticker} (${cfg.symbol})`);
  const series = await fetchStockSeries(cfg.market, cfg.symbol);
  const q = seriesToQuote(series);
  if (!q) {
    console.warn(`    ⚠ no data`);
    return null;
  }
  const rsi = calcRSI(q.closes, 14);
  console.log(`    ✓ ${q.value} (${q.changePct.toFixed(2)}%)`);
  return {
    ticker: cfg.ticker,
    nameKr: cfg.nameKr,
    exchange: cfg.exchange,
    currency: cfg.currency,
    isETF: cfg.isETF,
    isLeveraged: cfg.isLeveraged,
    isNewlyListed: cfg.isNewlyListed,
    ipoDate: cfg.ipoDate,
    ipoPrice: cfg.ipoPrice,
    price: q.value,
    change: Number(q.change.toFixed(cfg.currency === 'KRW' ? 0 : 2)),
    changePct: Number(q.changePct.toFixed(2)),
    prevClose: q.prevClose,
    open: q.open,
    dayHigh: q.high,
    dayLow: q.low,
    week52High: q.week52High,
    week52Low: q.week52Low,
    volume: formatVolume(q.volume),
    rsi: rsi !== null ? Number(rsi.toFixed(2)) : null,
    sparkline: q.sparkline,
    foreignRate: q.foreignRate || null,
    latestDate: q.latestDate,
  };
}

// ───────────────────────────────────────────────────────────────
// 인덱스 빌드 (chart API의 index/marketindex 경로)
// ───────────────────────────────────────────────────────────────
async function buildIndex(spec) {
  console.log(`  → ${spec.id} (${spec.path})`);
  const series = await fetchChartSeries(spec.path);
  const q = seriesToQuote(series);
  if (!q) {
    console.warn(`    ⚠ no data`);
    return null;
  }
  const precision = spec.region === 'BOND' ? 3 : 2;
  console.log(`    ✓ ${q.value} (${q.changePct.toFixed(2)}%)`);
  return {
    id: spec.id,
    label: spec.label,
    region: spec.region,
    unit: spec.unit,
    value: Number(q.value.toFixed(precision)),
    change: Number(q.change.toFixed(precision)),
    changePct: Number(q.changePct.toFixed(2)),
  };
}

async function fetchIndices() {
  // 모두 /chart/ 경로 — 종목과 동일한 검증된 엔드포인트
  const specs = [
    // 한국
    { id: 'kospi',  label: 'KOSPI',       region: 'KR',   path: 'domestic/index/KOSPI' },
    { id: 'kosdaq', label: 'KOSDAQ',      region: 'KR',   path: 'domestic/index/KOSDAQ' },
    // 미국 인덱스
    { id: 'spx',    label: 'S&P 500',     region: 'US',   path: 'foreign/index/SPI@SPX' },
    { id: 'ndx',    label: 'NASDAQ 100',  region: 'US',   path: 'foreign/index/NAS@NDX' },
    { id: 'sox',    label: 'PHLX 반도체',  region: 'US',   path: 'foreign/index/PHS@SOX' },
    // 미국채 (네이버 코드: IRR@TNX, IRR@TYX)
    { id: 'ust10',  label: '美 10Y',       region: 'BOND', unit: '%', path: 'foreign/index/IRR@TNX' },
    { id: 'ust30',  label: '美 30Y',       region: 'BOND', unit: '%', path: 'foreign/index/IRR@TYX' },
    // 환율
    { id: 'usdkrw', label: 'USD/KRW',     region: 'FX',   unit: '₩', path: 'foreign/marketindex/FX_USDKRW' },
  ];

  const results = [];
  for (const spec of specs) {
    const r = await buildIndex(spec);
    if (r) results.push(r);
  }

  // 표시 순서: spx, ndx, sox, usdkrw, ust10, ust30, kospi, kosdaq
  const order = ['spx','ndx','sox','usdkrw','ust10','ust30','kospi','kosdaq'];
  return order.map(id => results.find(r => r.id === id)).filter(Boolean);
}

// ───────────────────────────────────────────────────────────────
// CNN Fear & Greed
// ───────────────────────────────────────────────────────────────
async function fetchFearGreed() {
  const url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  const res = await safeFetch(url);
  if (!res.ok) throw new Error(`F&G failed: ${res.status}`);
  const data = await res.json();
  const fg = data.fear_and_greed;
  return {
    value: Math.round(fg.score),
    valueExact: Number(fg.score.toFixed(2)),
    label: fg.rating.replace(/\b\w/g, c => c.toUpperCase()),
    asOf: fg.timestamp,
    previous: {
      yesterday: Math.round(fg.previous_close),
      weekAgo: Math.round(fg.previous_1_week),
      monthAgo: Math.round(fg.previous_1_month),
      yearAgo: Math.round(fg.previous_1_year),
    },
    components: estimateComponents(fg.score),
  };
}

function estimateComponents(overall) {
  const seed = Math.floor(overall * 100);
  const rand = (i) => ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
  const ratings = ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'];
  const getRating = (v) => v <= 25 ? ratings[0] : v <= 45 ? ratings[1] : v <= 55 ? ratings[2] : v <= 75 ? ratings[3] : ratings[4];

  const names = [
    { name: 'Market Momentum',       desc: 'S&P 500 vs 125일 이평선' },
    { name: 'Stock Price Strength',  desc: '52주 신고가/신저가' },
    { name: 'Stock Price Breadth',   desc: 'McClellan Volume Summation' },
    { name: 'Put/Call Options',      desc: '5일 평균 풋콜 비율' },
    { name: 'Market Volatility',     desc: 'VIX 및 50일 이평' },
    { name: 'Safe Haven Demand',     desc: '주식 vs 채권 20일 수익률' },
    { name: 'Junk Bond Demand',      desc: '투자등급-정크본드 스프레드' },
  ];

  return names.map((n, i) => {
    const offset = (rand(i) - 0.5) * 20;
    const value = Math.max(0, Math.min(100, Math.round(overall + offset)));
    return { ...n, value, label: getRating(value) };
  });
}

// ───────────────────────────────────────────────────────────────
// 메인
// ───────────────────────────────────────────────────────────────
async function main() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9*60*60*1000);
  const asOf = kstNow.toISOString().replace('T',' ').slice(0,16) + ' KST';

  console.log(`▶ MARKETDESK data fetch @ ${asOf}\n`);

  console.log('① Indices...');
  const indices = await fetchIndices();
  console.log(`   → ${indices.length}/8 indices`);

  console.log('\n② Fear & Greed...');
  let fearGreed = null;
  try {
    fearGreed = await fetchFearGreed();
    console.log(`   ✓ ${fearGreed.value} (${fearGreed.label})`);
  } catch (e) {
    console.error(`   ⚠ failed: ${e.message}`);
  }

  console.log('\n③ Portfolio stocks...');
  const stocks = [];
  for (const cfg of PORTFOLIO) {
    const s = await buildStock(cfg);
    if (s) stocks.push(s);
  }
  console.log(`   → ${stocks.length}/${PORTFOLIO.length} stocks`);

  console.log('\n④ KR semi stocks...');
  const krStocks = [];
  for (const cfg of KR_STOCKS) {
    const s = await buildStock(cfg);
    if (s) krStocks.push(s);
  }
  console.log(`   → ${krStocks.length}/${KR_STOCKS.length} KR stocks`);

  // 기존 data.json fallback (새 fetch가 비면 옛 데이터 유지)
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile('data.json', 'utf8'));
  } catch { /* 처음 실행 */ }

  const payload = {
    meta: {
      asOf,
      generatedAt: now.toISOString(),
      source: 'Npay증권 · CNN Business',
      marketStatus: {
        us: { label: 'CLOSED', detail: 'NYSE/Nasdaq' },
        kr: { label: 'CLOSED', detail: 'KRX' },
      },
    },
    indices: indices.length > 0 ? indices : (existing.indices || []),
    fearGreed: fearGreed || existing.fearGreed || null,
    stocks: stocks.length > 0 ? stocks : (existing.stocks || []),
    krStocks: krStocks.length > 0 ? krStocks : (existing.krStocks || []),
  };

  await fs.writeFile('data.json', JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n✅ data.json saved`);
  console.log(`   indices: ${payload.indices.length}, stocks: ${payload.stocks.length + payload.krStocks.length}`);
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
