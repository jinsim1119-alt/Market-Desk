// MARKETDESK — 2차 진단: 미국 인덱스 / 채권 / 환율 대체 소스 확인
// 1차 진단 결과: 네이버는 한국 데이터만 GitHub Actions IP에 제공함
// 실행: node scripts/probe.mjs

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function probe(label, url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': '*/*', ...(opts.headers || {}) },
    });
    const text = await res.text();
    let summary = '';
    if (res.ok) {
      const trimmed = text.trim();
      // JSON?
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const j = JSON.parse(trimmed);
          summary = `JSON: ${JSON.stringify(j).slice(0, 200)}`;
        } catch {
          summary = `text(${trimmed.length}): ${trimmed.slice(0,150)}`;
        }
      } else {
        summary = `text(${trimmed.length}): ${trimmed.slice(0,200)}`;
      }
    } else {
      summary = `ERR: ${text.slice(0, 150)}`;
    }
    console.log(`  [${res.status}] ${label}\n      ${summary}\n`);
  } catch (e) {
    console.log(`  [ERR] ${label}\n      ${e.message}\n`);
  }
}

console.log('═══════════════════════════════════════════════════');
console.log(`▶ US DATA SOURCE PROBE @ ${new Date().toISOString()}`);
console.log('═══════════════════════════════════════════════════\n');

console.log('━━━ A. Stooq.com (CSV 시세) ━━━');
await probe('Stooq SPX',     'https://stooq.com/q/l/?s=^spx&f=sd2t2ohlcvn&h&e=csv');
await probe('Stooq NDX',     'https://stooq.com/q/l/?s=^ndx&f=sd2t2ohlcvn&h&e=csv');
await probe('Stooq SOX',     'https://stooq.com/q/l/?s=^sox&f=sd2t2ohlcvn&h&e=csv');
await probe('Stooq 10usy.b', 'https://stooq.com/q/l/?s=10usy.b&f=sd2t2ohlcvn&h&e=csv');
await probe('Stooq 30usy.b', 'https://stooq.com/q/l/?s=30usy.b&f=sd2t2ohlcvn&h&e=csv');
await probe('Stooq usdkrw',  'https://stooq.com/q/l/?s=usdkrw&f=sd2t2ohlcvn&h&e=csv');

console.log('━━━ B. Frankfurter (ECB 환율, 키 없음) ━━━');
await probe('Frankfurter latest USD->KRW', 'https://api.frankfurter.app/latest?from=USD&to=KRW');
await probe('Frankfurter yesterday',       'https://api.frankfurter.app/2026-06-26?from=USD&to=KRW');

console.log('━━━ C. exchangerate-api (무료, 키 없음) ━━━');
await probe('exchangerate-api USD', 'https://open.er-api.com/v6/latest/USD');

console.log('━━━ D. FRED CSV (미 정부 채권) ━━━');
await probe('FRED DGS10 csv', 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10');
await probe('FRED DGS30 csv', 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30');

console.log('━━━ E. US Treasury Direct (미 재무부 공식) ━━━');
await probe('Treasury daily yield curve',
  'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv');

console.log('━━━ F. Yahoo Finance (Quote 단일) ━━━');
await probe('Yahoo ^GSPC v8', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=5d');
await probe('Yahoo ^GSPC v6', 'https://query1.finance.yahoo.com/v6/finance/quote?symbols=%5EGSPC');
await probe('Yahoo ^TNX',     'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d');

console.log('━━━ G. Investing.com 모바일 ━━━');
await probe('Investing SPX',
  'https://api.investing.com/api/financialdata/historical/166?start-date=2026-06-01&end-date=2026-06-28&time-frame=Daily&add-missing-rows=false',
  { headers: { 'domain-id': 'www' } });

console.log('━━━ H. CNBC Quote API ━━━');
await probe('CNBC .SPX',  'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=.SPX&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json');
await probe('CNBC US10Y', 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=US10Y&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json');

console.log('━━━ I. WSJ Quote ━━━');
await probe('WSJ SPX',
  'https://api-secure.wsj.net/api/michelangelo/timeseries/history?json={"Step":"PT1M","TimeFrame":"D5","StartDate":null,"EndDate":null,"EntitlementToken":"57494d5ed7ad44af85bc59a51dd87c90","IncludeMockTicks":false,"FilterNullSlots":false,"FilterClosedPoints":true,"IncludeOfficialClose":true,"InjectOpen":false,"ShowPreMarket":false,"ShowAfterHours":false,"UseExtendedTimeFrame":true,"WantPriorClose":false,"IncludeCurrentQuotes":false,"ResetTodaysAfterHoursPercentChange":false,"Series":[{"Key":"INDEX/US/XNYS/SPX","Dialect":"Charting","Kind":"Ticker","SeriesId":"s1","DataTypes":["Last"],"Indicators":[]}]}&ckey=cecc4267a0',
  { headers: { 'Dylan2010.EntitlementToken': 'cecc4267a0' } });

console.log('━━━ J. Korea ExIm Bank (한국수출입은행 환율) ━━━');
// 키 필요해서 일단 skip — 위 frankfurter로 충분

console.log('═══════════════════════════════════════════════════');
console.log('PROBE COMPLETE');
console.log('═══════════════════════════════════════════════════');
