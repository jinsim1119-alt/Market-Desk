// MARKETDESK — 진단 스크립트
// 어떤 네이버 인덱스 심볼이 GitHub Actions에서 작동하는지 확인
// 실행: node scripts/probe.mjs

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const today = new Date();
const todayStr = today.toISOString().slice(0,10).replaceAll('-','');
const past = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
const pastStr = past.toISOString().slice(0,10).replaceAll('-','');

async function probe(label, url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://m.stock.naver.com/',
      },
    });
    const text = await res.text();
    let summary = '';
    if (res.ok) {
      try {
        const j = JSON.parse(text);
        if (Array.isArray(j)) {
          summary = `array len=${j.length}, first=${j.length > 0 ? JSON.stringify(j[0]).slice(0,150) : 'empty'}`;
        } else if (j && typeof j === 'object') {
          const keys = Object.keys(j).slice(0, 8).join(',');
          const closePrice = j.closePrice ?? j.currentPrice ?? '';
          summary = `obj keys=[${keys}...] closePrice=${closePrice}`;
        } else {
          summary = `scalar=${String(j).slice(0,100)}`;
        }
      } catch {
        summary = `text=${text.slice(0,100)}`;
      }
    } else {
      summary = text.slice(0, 100);
    }
    console.log(`  [${res.status}] ${label}\n      ${summary}`);
  } catch (e) {
    console.log(`  [ERR] ${label}\n      ${e.message}`);
  }
}

console.log('═══════════════════════════════════════════════════');
console.log(`▶ NAVER ENDPOINT PROBE @ ${new Date().toISOString()}`);
console.log('═══════════════════════════════════════════════════\n');

console.log('━━━ A. 한국 인덱스 (chart API) ━━━');
await probe('KOSPI chart',  `https://api.stock.naver.com/chart/domestic/index/KOSPI/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('KOSDAQ chart', `https://api.stock.naver.com/chart/domestic/index/KOSDAQ/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);

console.log('\n━━━ B. 미국 인덱스 (chart API, @ vs %40) ━━━');
await probe('SPI@SPX raw',     `https://api.stock.naver.com/chart/foreign/index/SPI@SPX/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('SPI@SPX encoded', `https://api.stock.naver.com/chart/foreign/index/SPI%40SPX/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('NAS@NDX',         `https://api.stock.naver.com/chart/foreign/index/NAS@NDX/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('NAS@IXIC',        `https://api.stock.naver.com/chart/foreign/index/NAS@IXIC/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('PHS@SOX',         `https://api.stock.naver.com/chart/foreign/index/PHS@SOX/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('DOW@DJI',         `https://api.stock.naver.com/chart/foreign/index/DOW@DJI/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);

console.log('\n━━━ C. 채권 금리 (여러 후보) ━━━');
await probe('IRR@TNX',  `https://api.stock.naver.com/chart/foreign/index/IRR@TNX/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('IRR@TYX',  `https://api.stock.naver.com/chart/foreign/index/IRR@TYX/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('CBO@TNX',  `https://api.stock.naver.com/chart/foreign/index/CBO@TNX/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);

console.log('\n━━━ D. 환율 (여러 경로) ━━━');
await probe('FX_USDKRW chart',    `https://api.stock.naver.com/chart/foreign/marketindex/FX_USDKRW/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('FX_USDKRW basic',    `https://api.stock.naver.com/marketindex/exchange/FX_USDKRW/basic`);
await probe('USDKRW chart noFX',  `https://api.stock.naver.com/chart/foreign/marketindex/USDKRW/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);

console.log('\n━━━ E. 종목 (SOXL 변형 확인) ━━━');
await probe('SOXL bare',  `https://api.stock.naver.com/chart/foreign/item/SOXL/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('SOXL.K',     `https://api.stock.naver.com/chart/foreign/item/SOXL.K/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);
await probe('SOXL.O',     `https://api.stock.naver.com/chart/foreign/item/SOXL.O/day?startDateTime=${pastStr}&endDateTime=${todayStr}`);

console.log('\n━━━ F. 인덱스 basic API (이전에 실패한 것) ━━━');
await probe('KOSPI basic',     `https://api.stock.naver.com/index/KOSPI/basic`);
await probe('SPI%40SPX basic', `https://api.stock.naver.com/index/SPI%40SPX/basic`);

console.log('\n═══════════════════════════════════════════════════');
console.log('PROBE COMPLETE — copy the entire log and share');
console.log('═══════════════════════════════════════════════════');
