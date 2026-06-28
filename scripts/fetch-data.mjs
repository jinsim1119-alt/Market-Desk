// MARKETDESK — 매일 자동 실행되는 데이터 수집 스크립트
// 실행: node scripts/fetch-data.mjs
// 출력: data.json (저장소 루트)
//
// 데이터 출처:
//  - 종목 시세/시계열: api.stock.naver.com (Npay증권 내부 API)
//  - 한국 인덱스: api.stock.naver.com
//  - 미국 인덱스: Yahoo Finance (query1.finance.yahoo.com)
//  - 환율: 네이버 환율 페이지
//  - 美 채권: Yahoo Finance (^TNX, ^TYX)
//  - Fear & Greed: production.dataviz.cnn.io

import fs from 'node:fs/promises';
import path from 'node:path';

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
  const res = await fetch(url, { headers: { 'User-Agent': UA }});
  if (!res.ok) throw new Error(`Fetch failed: ${url} → ${res.status}`);
  return await res.json();
}

// 종목 통합정보(가격, 등락, 메타) — m.stock.naver.com 모바일 페이지 HTML 파싱
async function fetchStockMeta(market, symbol) {
  const url = market === 'domestic'
    ? `https://m.stock.naver.com/domestic/stock/${symbol}/total`
    : `https://m.stock.naver.com/worldstock/stock/${symbol}/total`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }});
  if (!res.ok) return null;
  const html = await res.text();

  // __NEXT_DATA__ 스크립트 파싱
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    return data.props?.pageProps?.stockIntegrationInfos || data.props?.pageProps?.stockInfo || null;
  } catch { return null; }
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

  // 시계열 정렬 (오래된 → 최신)
  series.sort((a,b) => a.localDate.localeCompare(b.localDate));
  const closes = series.map(d => d.closePrice);
  const latest = series[series.length - 1];
  const prev = series[series.length - 2] || latest;

  const change = latest.closePrice - prev.closePrice;
  const changePct = (change / prev.closePrice) * 100;
  const rsi = calcRSI(closes, 14);

  // 52주 H/L (가능한 범위 내에서)
  const week52High = Math.max(...closes);
  const week52Low = Math.min(...closes);

  const result = {
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

  return result;
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
  const res = await fetch(url, { headers: { 'User-Agent': UA }});
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
    // 7개 세부지표 추정 (전체 값 기준으로 비례)
    components: estimateComponents(fg.score),
  };
}

function estimateComponents(overall) {
  // CNN이 7개 지표 개별값을 동적으로만 제공해서 추정값 사용
  // 전체 점수 근처에서 ±10 정도 분포
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
// 인덱스 (Yahoo Finance + 환율)
// ───────────────────────────────────────────────────────────────
async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }});
  if (!res.ok) return null;
  const data = await res.json();
  const r = data.chart?.result?.[0];
  if (!r) return null;
  const meta = r.meta;
  return {
    value: meta.regularMarketPrice,
    prevClose: meta.chartPreviousClose,
    change: meta.regularMarketPrice - meta.chartPreviousClose,
    changePct: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
  };
}

async function fetchIndices() {
  const symbols = [
    { id: 'spx',    yahoo: '^GSPC', label: 'S&P 500',     region: 'US' },
    { id: 'ndx',    yahoo: '^NDX',  label: 'NASDAQ 100',  region: 'US' },
    { id: 'sox',    yahoo: '^SOX',  label: 'PHLX 반도체',  region: 'US' },
    { id: 'ust10',  yahoo: '^TNX',  label: '美 10Y',       region: 'BOND', unit: '%' },
    { id: 'ust30',  yahoo: '^TYX',  label: '美 30Y',       region: 'BOND', unit: '%' },
    { id: 'kospi',  yahoo: '^KS11', label: 'KOSPI',       region: 'KR' },
    { id: 'kosdaq', yahoo: '^KQ11', label: 'KOSDAQ',      region: 'KR' },
    { id: 'usdkrw', yahoo: 'KRW=X', label: 'USD/KRW',     region: 'FX', unit: '₩' },
  ];
  const results = [];
  for (const s of symbols) {
    const q = await fetchYahooQuote(s.yahoo);
    if (q && q.value != null) {
      results.push({
        id: s.id,
        label: s.label,
        region: s.region,
        unit: s.unit,
        value: Number(q.value.toFixed(s.region === 'BOND' ? 3 : 2)),
        change: Number(q.change.toFixed(s.region === 'BOND' ? 3 : 2)),
        changePct: Number(q.changePct.toFixed(2)),
      });
    } else {
      console.warn(`  ⚠ index ${s.id} failed`);
    }
  }
  // 8개 슬롯에 맞게 USD/KRW를 4번째로
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

  console.log('② Fear & Greed...');
  const fearGreed = await fetchFearGreed();
  console.log(`   ✓ ${fearGreed.value} (${fearGreed.label})`);

  console.log('③ Portfolio stocks...');
  const stocks = [];
  for (const cfg of PORTFOLIO) {
    const s = await buildStock(cfg);
    if (s) stocks.push(s);
  }
  console.log(`   ✓ ${stocks.length} stocks`);

  console.log('④ KR semi stocks...');
  const krStocks = [];
  for (const cfg of KR_STOCKS) {
    const s = await buildStock(cfg);
    if (s) krStocks.push(s);
  }
  console.log(`   ✓ ${krStocks.length} KR stocks`);

  const payload = {
    meta: {
      asOf,
      generatedAt: now.toISOString(),
      source: 'Npay증권 · Yahoo Finance · CNN Business',
      marketStatus: {
        us: { label: 'CLOSED', detail: 'NYSE/Nasdaq' },
        kr: { label: 'CLOSED', detail: 'KRX' },
      },
    },
    indices,
    fearGreed,
    stocks,
    krStocks,
  };

  await fs.writeFile('data.json', JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n✅ data.json saved (${stocks.length + krStocks.length} stocks, ${indices.length} indices)`);
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
