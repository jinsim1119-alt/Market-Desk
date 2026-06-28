// 금융 대시보드 — 실데이터
// 출처: Npay증권(api.stock.naver.com) · CNN Business
// 기준: 2026-06-26 마감 / 06-27 KST 아침
// RSI(14): Wilder's smoothing 방식, 5월부터 38일 시계열 기반 정확 계산
// (스파크라인은 최근 18거래일 종가)

window.MARKET_DATA = {
  meta: {
    asOf: '2026-06-27 09:00 KST',
    source: 'Npay증권 · CNN Business · RSI 자체계산',
    marketStatus: {
      us: { label: 'CLOSED', detail: '06-26 16:00 EDT 마감' },
      kr: { label: 'CLOSED', detail: '06-26 15:30 KST 마감' },
    },
  },

  indices: [
    { id: 'spx',    label: 'S&P 500',     value:  7354.02, change:    -3.47, changePct: -0.05, region: 'US' },
    { id: 'ndx',    label: 'NASDAQ 100',  value: 29118.24, change:  -322.08, changePct: -1.09, region: 'US' },
    { id: 'sox',    label: 'PHLX 반도체',  value: 13203.57, change:  -737.30, changePct: -5.29, region: 'US' },
    { id: 'usdkrw', label: 'USD/KRW',     value:  1538.00, change:    -7.00, changePct: -0.45, region: 'FX', unit: '₩' },
    { id: 'ust10',  label: '美 10Y',       value:  3.842,  change:   -0.082, changePct: -2.09, region: 'BOND', unit: '%', estimated: true },
    { id: 'ust30',  label: '美 30Y',       value:  4.318,  change:   -0.064, changePct: -1.46, region: 'BOND', unit: '%', estimated: true },
    { id: 'kospi',  label: 'KOSPI',       value:  8411.21, change:  -519.09, changePct: -5.81, region: 'KR' },
    { id: 'kosdaq', label: 'KOSDAQ',      value:   851.37, change:   -36.44, changePct: -4.10, region: 'KR' },
  ],

  fearGreed: {
    value: 25,
    valueExact: 24.77,
    label: 'Extreme Fear',
    asOf: '2026-06-26 23:59 UTC',
    previous: { yesterday: 25, weekAgo: 38, monthAgo: 61, yearAgo: 63 },
    components: [
      { name: 'Market Momentum',       value: 18, label: 'Extreme Fear', desc: 'S&P 500 vs 125일 이평선' },
      { name: 'Stock Price Strength',  value: 22, label: 'Extreme Fear', desc: '52주 신고가/신저가' },
      { name: 'Stock Price Breadth',   value: 28, label: 'Fear',         desc: 'McClellan Volume Summation' },
      { name: 'Put/Call Options',      value: 24, label: 'Extreme Fear', desc: '5일 평균 풋콜 비율' },
      { name: 'Market Volatility',     value: 32, label: 'Fear',         desc: 'VIX 및 50일 이평' },
      { name: 'Safe Haven Demand',     value: 19, label: 'Extreme Fear', desc: '주식 vs 채권 20일 수익률' },
      { name: 'Junk Bond Demand',      value: 30, label: 'Fear',         desc: '투자등급-정크본드 스프레드' },
    ],
  },

  // 메인 포트폴리오 (8종목)
  // 1행: SOXL, QLD, NVDA, GOOGL  /  2행: TSLA, SPCX, TLTW, 473330
  stocks: [
    {
      ticker: 'SOXL', nameKr: 'Direxion 반도체 3X',
      exchange: 'AMEX', currency: 'USD', isETF: true, isLeveraged: '3x',
      price: 215.60, change: -37.01, changePct: -14.65, prevClose: 252.61,
      open: 226.24, dayHigh: 231.25, dayLow: 212.10,
      volume: '52.0M', marketCap: '$24.9B', per: null,
      return1M: 33.12, return3M: 344.27, return1Y: 931.86,
      rsi: 49.40,
      sparkline: [266.32,280.54,262.7,182.54,211.44,201.68,180.65,223.99,234.68,272.5,226.19,233.86,279.29,300.77,231.42,229.57,252.61,215.6],
    },
    {
      ticker: 'QLD', nameKr: 'ProShares 울트라 QQQ',
      exchange: 'AMEX', currency: 'USD', isETF: true, isLeveraged: '2x',
      price: 89.12, change: -2.65, changePct: -2.89, prevClose: 91.77,
      open: 89.39, dayHigh: 91.52, dayLow: 88.30,
      volume: '4.5M', marketCap: '$13.3B', per: null,
      return1M: -2.88, return3M: 42.55, return1Y: 59.76,
      rsi: 45.67,
      sparkline: [100.53,100,99.02,89.54,92.25,90.12,86.51,92.18,93.38,99.18,95.46,93.56,97.91,97.68,91.22,90.37,91.77,89.12],
    },
    {
      ticker: 'NVDA', nameKr: '엔비디아',
      exchange: 'NASDAQ', currency: 'USD',
      price: 192.53, change: -3.21, changePct: -1.64, prevClose: 195.74,
      open: 193.12, dayHigh: 195.55, dayLow: 191.22,
      week52High: 236.54, week52Low: 151.49,
      volume: '179.3M', marketCap: '$4.66T', per: 29.45, eps: 6.54, dividendYield: 0.51,
      rsi: 39.23,
      sparkline: [222.82,214.75,218.66,205.1,208.64,208.19,200.42,204.87,205.19,212.45,207.41,204.65,210.69,208.65,200.04,199,195.74,192.53],
    },
    {
      ticker: 'GOOGL', nameKr: '알파벳 A',
      exchange: 'NASDAQ', currency: 'USD',
      price: 337.39, change: -6.32, changePct: -1.84, prevClose: 343.71,
      open: 342.55, dayHigh: 346.36, dayLow: 330.20,
      week52High: 408.61, week52Low: 169.94,
      volume: '114.7M', marketCap: '$2.26T', per: 24.92, eps: 13.54, dividendYield: 0.26,
      rsi: 31.52,
      sparkline: [361.85,358.99,372.19,368.53,363.31,364.26,356.38,357.77,359.68,369.35,373.25,363.79,368.03,349.68,346.13,345.29,343.71,337.39],
    },
    {
      ticker: 'TSLA', nameKr: '테슬라',
      exchange: 'NASDAQ', currency: 'USD',
      price: 379.71, change: +4.59, changePct: +1.22, prevClose: 375.12,
      open: 370.15, dayHigh: 387.80, dayLow: 368.60,
      week52High: 498.83, week52Low: 288.77,
      volume: '53.4M', marketCap: '$1.43T', per: 323.06, eps: 1.18,
      rsi: 42.26,
      sparkline: [423.74,423.7,418.45,391,408.95,396.68,381.59,399.15,406.43,411.15,404.66,396.38,400.49,405.05,381.61,375.53,375.12,379.71],
    },
    {
      ticker: 'SPCX', nameKr: '스페이스X',
      exchange: 'NASDAQ', currency: 'USD',
      isNewlyListed: true, ipoDate: '2026-06-12', ipoPrice: 135.00, ndx100Inclusion: '2026-07-07',
      price: 153.23, change: +0.23, changePct: +0.15, prevClose: 153.00,
      open: 150.62, dayHigh: 158.40, dayLow: 148.51,
      week52High: 225.64, week52Low: 147.11,
      volume: '126.9M', marketCap: '$2.02T', per: null, eps: -0.62, pbr: 48.18,
      rsi: null,  // 10거래일 — 14일 RSI 계산 불가
      sparkline: [160.95,192.5,201.8,191.82,185,154.6,156.11,154.54,153,153.23],
    },
    {
      ticker: 'TLTW', nameKr: 'iShares 美20Y+ 커버드콜',
      exchange: 'AMEX', currency: 'USD', isETF: true,
      price: 22.52, change: +0.02, changePct: +0.07, prevClose: 22.51,
      open: 22.45, dayHigh: 22.52, dayLow: 22.45,
      volume: '1.1M', marketCap: '$1.94B', per: null,
      dividendYield: 11.7,
      return1M: 3.19, return3M: 2.02, return1Y: 9.54,
      rsi: 61.14,
      sparkline: [22.07,22.02,22.07,21.99,21.93,22.03,21.99,22.2,22.17,22.18,22.26,22.29,22.39,22.23,22.27,22.49,22.505,22.52],
    },
    {
      ticker: '473330', nameKr: 'SOL 美30Y국채커버드콜(합성)',
      exchange: 'KOSPI', currency: 'KRW', isETF: true,
      price: 9535, change: +5, changePct: +0.05, prevClose: 9530,
      open: 9550, dayHigh: 9580, dayLow: 9515,
      week52High: 9580, week52Low: 7920,
      volume: '0.39M', marketCap: '3,309억', per: null,
      dividendYield: 12.19,
      return1M: 5.07, return3M: 4.64, return1Y: 21.29,
      navPrem: -0.46,
      rsi: 71.09,
      sparkline: [9210,9245,9355,9245,9140,9225,9245,9275,9260,9245,9245,9405,9410,9445,9415,9445,9530,9535],
    },
  ],

  // 한국 반도체 (맨 아래 별도 섹션)
  krStocks: [
    {
      ticker: '005930', nameKr: '삼성전자',
      exchange: 'KOSPI', currency: 'KRW',
      price: 339500, change: -19000, changePct: -5.30, prevClose: 358500,
      open: 354000, dayHigh: 356500, dayLow: 321500,
      week52High: 380000, week52Low: 59800,
      volume: '35.2M', marketCap: '1,984.8조',
      per: 27.44, eps: 12372, dividendYield: 0.49,
      foreignRate: 47.37,
      rsi: 55.38,
      sparkline: [360500,351500,329000,295500,322000,302500,299000,322500,337000,343000,346500,362500,354000,353500,310000,340500,358500,339500],
    },
    {
      ticker: '000660', nameKr: 'SK하이닉스',
      exchange: 'KOSPI', currency: 'KRW',
      price: 2673000, change: -244000, changePct: -8.36, prevClose: 2917000,
      open: 2850000, dayHigh: 2880000, dayLow: 2600000,
      week52High: 3002000, week52Low: 244000,
      volume: '7.2M', marketCap: '1,945조',
      per: 25.82, eps: 103521, dividendYield: 0.11,
      foreignRate: 50.77,
      rsi: 60.07,
      sparkline: [2360000,2298000,2070000,1911000,2215000,2048000,2101000,2150000,2288000,2382000,2521000,2685000,2764000,2919000,2555000,2580000,2917000,2673000],
    },
  ],
};
