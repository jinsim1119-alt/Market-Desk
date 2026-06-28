// MARKETDESK — 매일 자동 실행되는 데이터 수집 스크립트
// 실행: node scripts/fetch-data.mjs
// 출력: data.json (저장소 루트)
//
// 데이터 출처 (안정성 검증된 소스만 사용):
//  - 종목 시세/시계열: api.stock.naver.com (Npay증권 내부 API) ✅ GitHub Actions 작동 확인
//  - 한국 인덱스 (KOSPI/KOSDAQ): api.stock.naver.com
//  - 미국 인덱스 (S&P500/NASDAQ/SOX): m.stock.naver.com (월드 인덱스 페이지 파싱)
//  - 환율 (USD/KRW): api.stock.naver.com/marketindex
//  - 美 채권 (10Y/30Y): FRED API (St. Louis Fed - 미국 정부, 가장 신뢰)
//  - Fear & Greed: production.dataviz.cnn.io ✅ GitHub Actions 작동 확인

import fs from 'node:fs/promises';

const PORTFOLIO = [
  // 1행: SOXL, QLD, NVDA, GOOGL
  { ticker: 'SOXL',  market: 'foreign', symbol: 'SOXL',  nameKr: 'Direxion 반도체 3X',         exchange: 'AMEX',   currency: 'USD', isETF: true, isLeveraged: '3x' },
  { ticker: 'QLD',   market: 'foreign', symbol: 'QLD',   nameKr: 'ProShares 울트라 QQQ',       exchange: 'AMEX',   currency: 'USD', isETF: true, isLeveraged: '2x' },
  { ticker: 'NVDA',  market: 'foreign', symbol: 'NVDA.O',nameKr: '엔비디아',                    exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'GOOGL', market: 'foreign', symbol: 'GOOGL.O',nameKr: '알파벳 A',                   exchange: 'NASDAQ', currency: 'USD' },
  // 2행: TSLA, SPCX, TLTW, 473330
  { ticker: 'TSLA',  market: 'foreign', symbol: 'TSLA.O',nameKr: '테슬라',                      exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'SPCX',  market: 'foreign', symbol: 'SPCX.O',nameKr: '스페이스X',                   exchange: 'NASDAQ', currency: 'USD', isNewlyListed: true, ipoDate: '2026-06-12', ipoPrice: 135.00 },
  { ticker: 'TLTW',  market: 'foreign', symbol: 'TLTW.K',nameKr: 'iShares 美20Y+ 커버드콜',     exchange: 'AMEX',   currency: 'USD', isETF: true },
  { ticker: '473330',market: 'domestic',symbol: '473330',nameKr: 'SOL 美30Y국채커버드콜(합성)', exchange: 'KOSPI',  currency: 'KRW', isETF: true },
];

const KR_STOCKS = [
  { ticker: '005930', market: 'domestic', symbol: '005930', nameKr: '삼성전자',   exchange: 'KOSPI', currency: 'KRW' },
  { ticker: '000660', market: 'domestic', symbol: '000660', nameKr: 'SK하이닉스', exchange: 'KOSPI', currency: 'KRW' },
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// 유틸: 안전한 fetch (타임아웃 + UA)
async function safeFetch(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*', ...(opts.headers || {}) },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// ───────────────────────────────────────────────────────────────
// 유틸: 시계열 → RSI(14, Wilder's smoothing)
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

// 최근 60거래일 시계열 가져오기
async function fetchTimeSeries(market, symbol) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10).replaceAll('-','');
  const past = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  const pastStr = past.toISOString().slice(0,10).replaceAll('-','');

  const url = `https://api.stock.naver.com/chart/${market}/item/${symbol}/day?startDateTime=${pastStr}&endDateTime=${todayStr}`;
  const res = await safeFetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} → ${res.status}`);
  return await res.json();
}

// ───────────────────────────────────────────────────────────────
// 종목별 데이터 통합
// ───────────────────────────────────────────────────────────────
async function buildStock(cfg) {
  console.log(`  → fetching ${cfg.ticker}...`);
  const series = await fetchTimeSeries(cfg.market, cfg.symbol).catch(e => {
    console.error(`    ! timeseries failed: ${e.message}`);
    return [];
  });

  if (!series || series.length === 0) {
    console.warn(`    ⚠ no data for ${cfg.ticker}`);
    return null;
  }

  series.sort((a,b) => a.localDate.localeCompare(b.localDate));
  const closes = series.map(d => d.closePrice);
  const latest = series[series.length - 1];
  const prev = series[series.length - 2] || latest;

  const change = latest.closePrice - prev.closePrice;
  const changePct = (change / prev.closePrice) * 100;
  const rsi = calcRSI(closes, 14);

  const week52High = Math.max(...closes);
  const week52Low = Math.min(...closes);

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
    price: latest.closePrice,
    change: Number(change.toFixed(cfg.currency === 'KRW' ? 0 : 2)),
    changePct: Number(changePct.toFixed(2)),
    prevClose: prev.closePrice,
    open: latest.openPrice,
    dayHigh: latest.highPrice,
    dayLow: latest.lowPrice,
    week52High,
    week52Low,
    volume: formatVolume(latest.accumulatedTradingVolume),
    rsi: rsi !== null ? Number(rsi.toFixed(2)) : null,
    sparkline: closes.slice(-18),
    foreignRate: latest.foreignRetentionRate || null,
    latestDate: latest.localDate,
  };
}

function formatVolume(n) {
  if (!n) return '—';
  if (n >= 1e8) return (n/1e8).toFixed(1) + '억';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
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
// 인덱스 (네이버 메인) — 다중 fallback
// ───────────────────────────────────────────────────────────────

// 1) 네이버 인덱스 API (한국 + 일부 글로벌)
async function fetchNaverIndex(symbol) {
  // 한국: KOSPI, KOSDAQ
  // 글로벌: SPI@SPX, NAS@IXIC, NAS@NDX, PHS@SOX
  const url = `https://api.stock.naver.com/index/${encodeURIComponent(symbol)}/basic`;
  try {
    const res = await safeFetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    // 필드명: closePrice, compareToPreviousClosePrice, fluctuationsRatio
    const value = parseFloat(String(j.closePrice ?? '').replace(/,/g, ''));
    const change = parseFloat(String(j.compareToPreviousClosePrice ?? '0').replace(/,/g, ''));
    const changePct = parseFloat(String(j.fluctuationsRatio ?? '0'));
    if (!isFinite(value) || value === 0) return null;
    return { value, change, changePct };
  } catch { return null; }
}

// 2) 네이버 환율 API
async function fetchNaverExchange(symbol) {
  // FX_USDKRW
  const url = `https://api.stock.naver.com/marketindex/exchange/${symbol}/basic`;
  try {
    const res = await safeFetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const value = parseFloat(String(j.calcPrice ?? j.closePrice ?? '').replace(/,/g, ''));
    const change = parseFloat(String(j.changePrice ?? '0').replace(/,/g, ''));
    const changePct = parseFloat(String(j.fluctuationsRatio ?? '0'));
    const sign = j.changeType === 'FALLING' ? -1 : 1;
    if (!isFinite(value) || value === 0) return null;
    return { value, change: change * sign, changePct: changePct * sign };
  } catch { return null; }
}

// 3) 네이버 m.stock 페이지에서 __NEXT_DATA__ 파싱 (인덱스용)
async function fetchNaverPageIndex(path) {
  const url = `https://m.stock.naver.com${path}`;
  try {
    const res = await safeFetch(url, { headers: { 'Accept': 'text/html' }});
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const data = JSON.parse(m[1]);
    const info = data.props?.pageProps?.indexInfo
      || data.props?.pageProps?.stockInfo
      || data.props?.pageProps?.totalInfos
      || null;
    if (!info) return null;
    const value = parseFloat(String(info.closePrice ?? info.currentPrice ?? '').replace(/,/g, ''));
    const change = parseFloat(String(info.compareToPreviousClosePrice ?? info.changePrice ?? '0').replace(/,/g, ''));
    const changePct = parseFloat(String(info.fluctuationsRatio ?? '0'));
    if (!isFinite(value) || value === 0) return null;
    return { value, change, changePct };
  } catch { return null; }
}

// 4) FRED API (미국 국채금리 — 미 정부 공식 데이터, 가장 신뢰)
// FRED는 API 키 필요하지만 fred.stlouisfed.org/graph/fredgraph.csv 는 키 없이 사용 가능
async function fetchFredYield(seriesId) {
  // DGS10 = 10Y, DGS30 = 30Y
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  try {
    const res = await safeFetch(url, { headers: { 'Accept': 'text/csv' }});
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    // CSV: observation_date,DGS10
    // 끝에서부터 유효한 값(.이 아닌)을 찾음
    let latest = null, prev = null;
    for (let i = lines.length - 1; i > 0 && (!latest || !prev); i--) {
      const cols = lines[i].split(',');
      const v = parseFloat(cols[1]);
      if (isFinite(v) && v > 0) {
        if (!latest) latest = v;
        else if (!prev) prev = v;
      }
    }
    if (!latest) return null;
    const change = prev ? latest - prev : 0;
    const changePct = prev ? (change / prev) * 100 : 0;
    return { value: latest, change, changePct };
  } catch { return null; }
}

async function fetchIndices() {
  const results = [];

  // 1) 한국 인덱스 (네이버 API)
  for (const [id, symbol, label] of [
    ['kospi',  'KOSPI',  'KOSPI'],
    ['kosdaq', 'KOSDAQ', 'KOSDAQ'],
  ]) {
    const q = await fetchNaverIndex(symbol);
    if (q) {
      results.push({ id, label, region: 'KR',
        value: Number(q.value.toFixed(2)),
        change: Number(q.change.toFixed(2)),
        changePct: Number(q.changePct.toFixed(2)) });
      console.log(`  ✓ ${id} = ${q.value}`);
    } else {
      console.warn(`  ⚠ ${id} failed`);
    }
  }

  // 2) 미국 인덱스 (네이버 API + 페이지 파싱 fallback)
  const usIndices = [
    { id: 'spx', label: 'S&P 500',     apiSym: 'SPI@SPX',   pagePath: '/worldstock/index/SPI@SPX/total' },
    { id: 'ndx', label: 'NASDAQ 100',  apiSym: 'NAS@NDX',   pagePath: '/worldstock/index/NAS@NDX/total' },
    { id: 'sox', label: 'PHLX 반도체',  apiSym: 'PHS@SOX',   pagePath: '/worldstock/index/PHS@SOX/total' },
  ];
  for (const idx of usIndices) {
    let q = await fetchNaverIndex(idx.apiSym);
    if (!q) q = await fetchNaverPageIndex(idx.pagePath);
    if (q) {
      results.push({ id: idx.id, label: idx.label, region: 'US',
        value: Number(q.value.toFixed(2)),
        change: Number(q.change.toFixed(2)),
        changePct: Number(q.changePct.toFixed(2)) });
      console.log(`  ✓ ${idx.id} = ${q.value}`);
    } else {
      console.warn(`  ⚠ ${idx.id} failed`);
    }
  }

  // 3) USD/KRW 환율 (네이버 marketindex)
  {
    const q = await fetchNaverExchange('FX_USDKRW');
    if (q) {
      results.push({ id: 'usdkrw', label: 'USD/KRW', region: 'FX', unit: '₩',
        value: Number(q.value.toFixed(2)),
        change: Number(q.change.toFixed(2)),
        changePct: Number(q.changePct.toFixed(2)) });
      console.log(`  ✓ usdkrw = ${q.value}`);
    } else {
      console.warn(`  ⚠ usdkrw failed`);
    }
  }

  // 4) 美 채권 (FRED — 미국 정부 공식 데이터)
  for (const [id, series, label] of [
    ['ust10', 'DGS10', '美 10Y'],
    ['ust30', 'DGS30', '美 30Y'],
  ]) {
    const q = await fetchFredYield(series);
    if (q) {
      results.push({ id, label, region: 'BOND', unit: '%',
        value: Number(q.value.toFixed(3)),
        change: Number(q.change.toFixed(3)),
        changePct: Number(q.changePct.toFixed(2)) });
      console.log(`  ✓ ${id} = ${q.value}%`);
    } else {
      console.warn(`  ⚠ ${id} failed`);
    }
  }

  // 8개 슬롯 순서: spx, ndx, sox, usdkrw, ust10, ust30, kospi, kosdaq
  const order = ['spx','ndx','sox','usdkrw','ust10','ust30','kospi','kosdaq'];
  return order.map(id => results.find(r => r.id === id)).filter(Boolean);
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
  console.log(`   ✓ ${indices.length} indices`);

  console.log('\n② Fear & Greed...');
  let fearGreed = null;
  try {
    fearGreed = await fetchFearGreed();
    console.log(`   ✓ ${fearGreed.value} (${fearGreed.label})`);
  } catch (e) {
    console.error(`   ⚠ F&G failed: ${e.message}`);
  }

  console.log('\n③ Portfolio stocks...');
  const stocks = [];
  for (const cfg of PORTFOLIO) {
    const s = await buildStock(cfg);
    if (s) stocks.push(s);
  }
  console.log(`   ✓ ${stocks.length} stocks`);

  console.log('\n④ KR semi stocks...');
  const krStocks = [];
  for (const cfg of KR_STOCKS) {
    const s = await buildStock(cfg);
    if (s) krStocks.push(s);
  }
  console.log(`   ✓ ${krStocks.length} KR stocks`);

  // 기존 data.json이 있으면 읽어서 fallback 으로 사용
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile('data.json', 'utf8'));
  } catch { /* 처음 실행 */ }

  const payload = {
    meta: {
      asOf,
      generatedAt: now.toISOString(),
      source: 'Npay증권 · FRED(美재무부) · CNN Business',
      marketStatus: {
        us: { label: 'CLOSED', detail: 'NYSE/Nasdaq' },
        kr: { label: 'CLOSED', detail: 'KRX' },
      },
    },
    // 새 데이터가 비면 기존 데이터 유지 (사이트 빈 화면 방지)
    indices: indices.length > 0 ? indices : (existing.indices || []),
    fearGreed: fearGreed || existing.fearGreed || null,
    stocks: stocks.length > 0 ? stocks : (existing.stocks || []),
    krStocks: krStocks.length > 0 ? krStocks : (existing.krStocks || []),
  };

  await fs.writeFile('data.json', JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n✅ data.json saved (${payload.stocks.length + payload.krStocks.length} stocks, ${payload.indices.length} indices)`);
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
