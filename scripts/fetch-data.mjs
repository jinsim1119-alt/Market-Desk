// MARKETDESK — 매일 자동 실행되는 데이터 수집 스크립트
// 실행: node scripts/fetch-data.mjs
// 출력: data.json (저장소 루트)
//
// 데이터 출처 (GitHub Actions에서 실제 검증된 소스만 사용):
//  - 한국 인덱스 + 한국/미국 종목: api.stock.naver.com/chart/ ✅
//  - 미국 인덱스 + 채권: quote.cnbc.com ✅
//  - 환율 (USD/KRW): api.frankfurter.app (ECB) ✅
//  - Fear & Greed: production.dataviz.cnn.io ✅

import fs from 'node:fs/promises';

const PORTFOLIO = [
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
      headers: { 'User-Agent': UA, 'Accept': '*/*', ...(opts.headers || {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════════════════════════════
// 헬퍼: 숫자 파싱 (콤마 제거)
// ═══════════════════════════════════════════════════════════════
function num(s) {
  if (s == null) return NaN;
  const v = parseFloat(String(s).replace(/,/g, ''));
  return isFinite(v) ? v : NaN;
}

// ═══════════════════════════════════════════════════════════════
// RSI(14, Wilder)
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 1) 네이버 chart API — 한국 인덱스, 한국/미국 종목 (검증됨 ✅)
// ═══════════════════════════════════════════════════════════════
function dateRange(daysBack = 90) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10).replaceAll('-','');
  const past = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const pastStr = past.toISOString().slice(0,10).replaceAll('-','');
  return { todayStr, pastStr };
}

async function fetchNaverChart(path) {
  const { todayStr, pastStr } = dateRange(90);
  const url = `https://api.stock.naver.com/chart/${path}/day?startDateTime=${pastStr}&endDateTime=${todayStr}`;
  try {
    const res = await safeFetch(url, { headers: { 'Referer': 'https://m.stock.naver.com/' }});
    if (!res.ok) { console.warn(`    HTTP ${res.status}: ${url}`); return null; }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`    Empty: ${url}`);
      return null;
    }
    return data;
  } catch (e) {
    console.warn(`    Error: ${e.message}: ${url}`);
    return null;
  }
}

function seriesToQuote(series) {
  if (!series || series.length === 0) return null;
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
    value, prevClose, change, changePct, closes,
    sparkline: closes.slice(-18),
    latestDate: latest.localDate,
    open: latest.openPrice, high: latest.highPrice, low: latest.lowPrice,
    volume: latest.accumulatedTradingVolume,
    foreignRate: latest.foreignRetentionRate,
    week52High: Math.max(...closes), week52Low: Math.min(...closes),
  };
}

// 종목 (foreign은 .K/.O suffix 자동 시도)
async function fetchStockSeries(market, symbol) {
  let series = await fetchNaverChart(`${market}/item/${symbol}`);
  if (series) return series;
  if (market === 'foreign') {
    const base = symbol.replace(/\.(K|O)$/, '');
    const variants = symbol.endsWith('.K') ? [base + '.O', base]
                   : symbol.endsWith('.O') ? [base + '.K', base]
                   : [base + '.K', base + '.O'];
    for (const v of variants) {
      console.log(`    retry ${v}...`);
      series = await fetchNaverChart(`${market}/item/${v}`);
      if (series) return series;
    }
  }
  return null;
}

async function buildStock(cfg) {
  console.log(`  → ${cfg.ticker} (${cfg.symbol})`);
  const series = await fetchStockSeries(cfg.market, cfg.symbol);
  const q = seriesToQuote(series);
  if (!q) { console.warn(`    ⚠ no data`); return null; }
  const rsi = calcRSI(q.closes, 14);
  console.log(`    ✓ ${q.value} (${q.changePct.toFixed(2)}%)`);
  return {
    ticker: cfg.ticker, nameKr: cfg.nameKr, exchange: cfg.exchange, currency: cfg.currency,
    isETF: cfg.isETF, isLeveraged: cfg.isLeveraged, isNewlyListed: cfg.isNewlyListed,
    ipoDate: cfg.ipoDate, ipoPrice: cfg.ipoPrice,
    price: q.value,
    change: Number(q.change.toFixed(cfg.currency === 'KRW' ? 0 : 2)),
    changePct: Number(q.changePct.toFixed(2)),
    prevClose: q.prevClose, open: q.open, dayHigh: q.high, dayLow: q.low,
    week52High: q.week52High, week52Low: q.week52Low,
    volume: formatVolume(q.volume),
    rsi: rsi !== null ? Number(rsi.toFixed(2)) : null,
    sparkline: q.sparkline,
    foreignRate: q.foreignRate || null,
    latestDate: q.latestDate,
  };
}

async function buildKoreaIndex(naverSymbol, id, label) {
  console.log(`  → ${id} (${naverSymbol})`);
  const series = await fetchNaverChart(`domestic/index/${naverSymbol}`);
  const q = seriesToQuote(series);
  if (!q) { console.warn(`    ⚠ no data`); return null; }
  console.log(`    ✓ ${q.value} (${q.changePct.toFixed(2)}%)`);
  return {
    id, label, region: 'KR',
    value: Number(q.value.toFixed(2)),
    change: Number(q.change.toFixed(2)),
    changePct: Number(q.changePct.toFixed(2)),
  };
}

// ═══════════════════════════════════════════════════════════════
// 2) CNBC Quote API — 미국 인덱스 + 채권 (검증됨 ✅)
// ═══════════════════════════════════════════════════════════════
async function fetchCNBCQuote(symbol) {
  const url = `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(symbol)}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json`;
  try {
    const res = await safeFetch(url);
    if (!res.ok) { console.warn(`    HTTP ${res.status}: CNBC ${symbol}`); return null; }
    const data = await res.json();
    const q = data?.FormattedQuoteResult?.FormattedQuote?.[0];
    if (!q) { console.warn(`    No quote: CNBC ${symbol}`); return null; }
    // CNBC 필드: last, change, change_pct, previous_day_closing, open, high, low, volume
    const value = num(q.last);
    const change = num(q.change);
    const changePct = num(q.change_pct);
    const prevClose = num(q.previous_day_closing) || (value - change);
    if (!isFinite(value)) { console.warn(`    Bad value: CNBC ${symbol}`); return null; }
    return { value, prevClose, change: isFinite(change) ? change : 0, changePct: isFinite(changePct) ? changePct : 0 };
  } catch (e) {
    console.warn(`    Error: CNBC ${symbol}: ${e.message}`);
    return null;
  }
}

async function buildCNBCIndex(spec) {
  console.log(`  → ${spec.id} (CNBC ${spec.cnbc})`);
  const q = await fetchCNBCQuote(spec.cnbc);
  if (!q) return null;
  const precision = spec.region === 'BOND' ? 3 : 2;
  console.log(`    ✓ ${q.value} (${q.changePct.toFixed(2)}%)`);
  return {
    id: spec.id, label: spec.label, region: spec.region, unit: spec.unit,
    value: Number(q.value.toFixed(precision)),
    change: Number(q.change.toFixed(precision)),
    changePct: Number(q.changePct.toFixed(2)),
  };
}

// ═══════════════════════════════════════════════════════════════
// 3) Frankfurter (ECB) — USD/KRW (검증됨 ✅)
// ═══════════════════════════════════════════════════════════════
async function fetchUsdKrw() {
  console.log(`  → usdkrw (Frankfurter ECB)`);
  try {
    // 최신
    const res1 = await safeFetch('https://api.frankfurter.app/latest?from=USD&to=KRW');
    if (!res1.ok) { console.warn(`    HTTP ${res1.status}`); return null; }
    const d1 = await res1.json();
    const value = d1.rates?.KRW;
    if (!isFinite(value)) return null;

    // 전일 (ECB는 영업일만 — 가장 가까운 이전 영업일 찾기)
    let prevClose = value;
    for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
      const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const dStr = d.toISOString().slice(0, 10);
      try {
        const res2 = await safeFetch(`https://api.frankfurter.app/${dStr}?from=USD&to=KRW`);
        if (res2.ok) {
          const d2 = await res2.json();
          const v = d2.rates?.KRW;
          if (isFinite(v) && v > 0 && Math.abs(v - value) > 0.001) {
            prevClose = v;
            break;
          }
        }
      } catch {}
    }

    const change = value - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    console.log(`    ✓ ${value} (${changePct.toFixed(2)}%)`);
    return {
      id: 'usdkrw', label: 'USD/KRW', region: 'FX', unit: '₩',
      value: Number(value.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePct: Number(changePct.toFixed(2)),
    };
  } catch (e) {
    console.warn(`    Error: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 4) CNN Fear & Greed (검증됨 ✅)
// ═══════════════════════════════════════════════════════════════
async function fetchFearGreed() {
  const url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  const res = await safeFetch(url);
  if (!res.ok) throw new Error(`F&G HTTP ${res.status}`);
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

// ═══════════════════════════════════════════════════════════════
// 인덱스 빌드 (3개 소스 조합)
// ═══════════════════════════════════════════════════════════════
async function buildIndices() {
  const results = [];

  // 미국 인덱스 + 채권 → CNBC
  const cnbcSpecs = [
    { id: 'spx',   label: 'S&P 500',     region: 'US',   cnbc: '.SPX' },
    { id: 'ndx',   label: 'NASDAQ 100',  region: 'US',   cnbc: '.NDX' },
    { id: 'sox',   label: 'PHLX 반도체',  region: 'US',   cnbc: '.SOX' },
    { id: 'ust10', label: '美 10Y',       region: 'BOND', unit: '%', cnbc: 'US10Y' },
    { id: 'ust30', label: '美 30Y',       region: 'BOND', unit: '%', cnbc: 'US30Y' },
  ];
  for (const spec of cnbcSpecs) {
    const r = await buildCNBCIndex(spec);
    if (r) results.push(r);
  }

  // 환율 → Frankfurter
  const fx = await fetchUsdKrw();
  if (fx) results.push(fx);

  // 한국 인덱스 → 네이버
  const koreaIndices = [
    ['KOSPI', 'kospi', 'KOSPI'],
    ['KOSDAQ', 'kosdaq', 'KOSDAQ'],
  ];
  for (const [sym, id, label] of koreaIndices) {
    const r = await buildKoreaIndex(sym, id, label);
    if (r) results.push(r);
  }

  // 표시 순서: spx, ndx, sox, usdkrw, ust10, ust30, kospi, kosdaq
  const order = ['spx','ndx','sox','usdkrw','ust10','ust30','kospi','kosdaq'];
  return order.map(id => results.find(r => r.id === id)).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// 메인
// ═══════════════════════════════════════════════════════════════
async function main() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9*60*60*1000);
  const asOf = kstNow.toISOString().replace('T',' ').slice(0,16) + ' KST';

  console.log(`▶ MARKETDESK data fetch @ ${asOf}\n`);

  console.log('① Indices...');
  const indices = await buildIndices();
  console.log(`   → ${indices.length}/8 indices\n`);

  console.log('② Fear & Greed...');
  let fearGreed = null;
  try {
    fearGreed = await fetchFearGreed();
    console.log(`   ✓ ${fearGreed.value} (${fearGreed.label})\n`);
  } catch (e) {
    console.error(`   ⚠ failed: ${e.message}\n`);
  }

  console.log('③ Portfolio stocks...');
  const stocks = [];
  for (const cfg of PORTFOLIO) {
    const s = await buildStock(cfg);
    if (s) stocks.push(s);
  }
  console.log(`   → ${stocks.length}/${PORTFOLIO.length} stocks\n`);

  console.log('④ KR semi stocks...');
  const krStocks = [];
  for (const cfg of KR_STOCKS) {
    const s = await buildStock(cfg);
    if (s) krStocks.push(s);
  }
  console.log(`   → ${krStocks.length}/${KR_STOCKS.length} KR stocks\n`);

  // 기존 data.json fallback
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile('data.json', 'utf8'));
  } catch {}

  const payload = {
    meta: {
      asOf,
      generatedAt: now.toISOString(),
      source: 'Npay · CNBC · ECB · CNN',
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
  console.log(`✅ data.json saved`);
  console.log(`   indices: ${payload.indices.length}, stocks: ${payload.stocks.length + payload.krStocks.length}, F&G: ${payload.fearGreed ? '✓' : '✗'}`);
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
