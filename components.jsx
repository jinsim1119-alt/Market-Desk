// 금융 대시보드 컴포넌트
const { useMemo, useState, useEffect, useRef } = React;

// ============================================================
// 유틸
// ============================================================
const fmtNumber = (n, opts = {}) => {
  const { decimals = 2, currency = null } = opts;
  if (n === null || n === undefined) return '—';
  const formatted = Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (currency === 'KRW') return '₩' + Number(n).toLocaleString('ko-KR');
  if (currency === 'USD') return '$' + formatted;
  return formatted;
};

const fmtPct = (n) => {
  if (n === null || n === undefined) return '—';
  const sign = n > 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
};

const fmtChange = (n, decimals = 2) => {
  if (n === null || n === undefined) return '—';
  const sign = n > 0 ? '+' : '';
  return sign + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// 최근 거래일 → "06.27" 형식 (YYYYMMDD 또는 YYYY-MM-DD 모두 지원)
const formatLatestDate = (s) => {
  if (!s) return '최근';
  const str = String(s).replace(/-/g, '');
  if (str.length >= 8) return str.slice(4, 6) + '.' + str.slice(6, 8);
  return s;
};

// 색상 컨벤션에 따라 상승/하락 색상 결정
const useColors = (convention) => {
  // convention: 'us' (상승 초록, 하락 빨강) or 'kr' (상승 빨강, 하락 파랑)
  if (convention === 'kr') {
    return { up: '#ef4444', down: '#3b82f6', flat: '#9aa3b2' };
  }
  return { up: '#22c55e', down: '#ef4444', flat: '#9aa3b2' };
};

const getChangeColor = (change, colors) => {
  if (change > 0) return colors.up;
  if (change < 0) return colors.down;
  return colors.flat;
};

// ============================================================
// 헤더
// ============================================================
function DashboardHeader({ meta, loadStatus }) {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
  const weekdays = ['일','월','화','수','목','금','토'];
  const dateStr = `${clock.getFullYear()}.${pad(clock.getMonth()+1)}.${pad(clock.getDate())} (${weekdays[clock.getDay()]})`;

  return (
    <header className="dash-header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-dot" />
          <span className="logo-text">MARKET<span className="logo-accent">DESK</span></span>
        </div>
        <div className="header-divider" />
        <div className="header-meta">
          <span className="meta-label">
            PORTFOLIO MONITOR
            {loadStatus === 'ok' && <span className="load-badge load-ok">● LIVE</span>}
            {loadStatus === 'cached' && <span className="load-badge load-cached">⚠ CACHED</span>}
            {loadStatus === 'loading' && <span className="load-badge load-loading">⟳ SYNC</span>}
            {loadStatus === 'fallback' && <span className="load-badge load-fallback">⚠ OFFLINE</span>}
          </span>
          <span className="meta-value">8 ASSETS · 4 INDICES · 4 MACRO</span>
        </div>
      </div>
      <div className="header-right">
        <div className="market-status">
          <div className="status-item">
            <span className={`status-dot status-${meta.marketStatus.us.label.toLowerCase()}`} />
            <span className="status-label">US</span>
            <span className="status-detail">{meta.marketStatus.us.detail}</span>
          </div>
          <div className="status-item">
            <span className={`status-dot status-${meta.marketStatus.kr.label.toLowerCase()}`} />
            <span className="status-label">KR</span>
            <span className="status-detail">{meta.marketStatus.kr.detail}</span>
          </div>
        </div>
        <div className="header-divider" />
        <div className="clock">
          <div className="clock-date">{dateStr}</div>
          <div className="clock-time">{timeStr} <span className="tz">KST</span></div>
        </div>
      </div>
    </header>
  );
}

// ============================================================
// 인덱스 바
// ============================================================
function IndexBar({ indices, colors }) {
  return (
    <div className="index-bar">
      {indices.map(idx => {
        const c = getChangeColor(idx.change, colors);
        const decimals = idx.region === 'BOND' ? 3 : (idx.region === 'FX' ? 2 : 2);
        return (
          <div className="index-cell" key={idx.id}>
            <div className="index-label-row">
              <span className="index-region">{idx.region}</span>
              <span className="index-label">{idx.label}</span>
              {idx.estimated && <span className="index-est">EST</span>}
            </div>
            <div className="index-value">
              {idx.unit === '%' ? idx.value.toFixed(3) + '%' :
               idx.unit === '₩' ? '₩' + fmtNumber(idx.value, { decimals: 2 }) :
               fmtNumber(idx.value, { decimals })}
            </div>
            <div className="index-change" style={{ color: c }}>
              <span className="change-arrow">{idx.change > 0 ? '▲' : idx.change < 0 ? '▼' : '—'}</span>
              <span className="change-val">{fmtChange(idx.change, decimals)}</span>
              <span className="change-pct">({fmtPct(idx.changePct)})</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 스파크라인
// ============================================================
function Sparkline({ data, color, width = 200, height = 48, fill = true }) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return { line: '', area: '' };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return [x, y];
    });

    const line = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
    const area = line + ` L ${width},${height} L 0,${height} Z`;
    return { line, area };
  }, [data, width, height]);

  const gradId = useMemo(() => 'spark-grad-' + Math.random().toString(36).slice(2, 9), []);

  return (
    <svg className="sparkline" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={path.area} fill={`url(#${gradId})`} />}
      <path d={path.line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================
// RSI 바
// ============================================================
function RSIBar({ value }) {
  if (value === null || value === undefined) {
    return (
      <div className="rsi-bar rsi-na">
        <div className="rsi-track">
          <div className="rsi-na-text">데이터 누적 중</div>
        </div>
      </div>
    );
  }
  let zone = 'neutral';
  let zoneLabel = 'Neutral';
  if (value >= 70) { zone = 'overbought'; zoneLabel = '과매수'; }
  else if (value <= 30) { zone = 'oversold'; zoneLabel = '과매도'; }

  return (
    <div className={`rsi-bar rsi-${zone}`}>
      <div className="rsi-header">
        <span className="rsi-label">RSI<span className="rsi-period">(14)</span></span>
        <span className="rsi-value">{value.toFixed(1)}</span>
        <span className="rsi-zone-label">{zoneLabel}</span>
      </div>
      <div className="rsi-track">
        <div className="rsi-zone-bg rsi-bg-oversold" />
        <div className="rsi-zone-bg rsi-bg-overbought" />
        <div className="rsi-fill" style={{ width: value + '%' }} />
        <div className="rsi-marker" style={{ left: value + '%' }} />
        <div className="rsi-line rsi-line-30" />
        <div className="rsi-line rsi-line-70" />
      </div>
      <div className="rsi-scale">
        <span>0</span><span>30</span><span>50</span><span>70</span><span>100</span>
      </div>
    </div>
  );
}

// ============================================================
// 종목 카드
// ============================================================
function StockCard({ stock, colors, density }) {
  const c = getChangeColor(stock.change, colors);
  const isKR = stock.currency === 'KRW';
  const priceDecimals = isKR ? 0 : 2;
  const changeDecimals = isKR ? 0 : 2;

  return (
    <article className="stock-card" data-up={stock.change > 0} data-down={stock.change < 0}>
      <header className="card-head">
        <div className="ticker-block">
          <div className="ticker-row">
            <span className="ticker">{stock.ticker.replace('.KS', '')}</span>
            {stock.isLeveraged && <span className="badge badge-lev">{stock.isLeveraged}</span>}
            {stock.isETF && !stock.isLeveraged && <span className="badge badge-etf">ETF</span>}
            {stock.isNewlyListed && <span className="badge badge-ipo">IPO</span>}
          </div>
          <div className="name-row">
            <span className="name-kr">{stock.nameKr}</span>
            <span className="exchange-tag">{stock.exchange.replace('.KS', '')}</span>
          </div>
        </div>
        <div className="day-change-pill" style={{ color: c, borderColor: c + '40', background: c + '14' }}>
          <span className="pill-arrow">{stock.change > 0 ? '▲' : stock.change < 0 ? '▼' : '—'}</span>
          <span className="pill-pct">{fmtPct(stock.changePct)}</span>
        </div>
      </header>

      <div className="price-block">
        <div className="price-main">
          {isKR ? '₩' + Number(stock.price).toLocaleString('ko-KR') : '$' + fmtNumber(stock.price, { decimals: priceDecimals })}
        </div>
        <div className="price-change" style={{ color: c }}>
          {fmtChange(stock.change, changeDecimals)} {isKR ? '원' : 'USD'}
        </div>
      </div>

      <div className="sparkline-block">
        <Sparkline data={stock.sparkline} color={c} height={56} />
        <div className="sparkline-axis">
          <span>{stock.sparkline ? stock.sparkline.length : 18}거래일 전</span>
          <span>{stock.latestDate ? formatLatestDate(stock.latestDate) : '최근'} 종가</span>
        </div>
      </div>

      <RSIBar value={stock.rsi} />

      {density !== 'compact' && (
        <div className="metrics-grid">
          {/* 52주 H/L (ETF 일부는 데이터 없음) */}
          {stock.week52High !== null && stock.week52High !== undefined ? (
            <>
              <div className="metric">
                <span className="metric-label">52W H</span>
                <span className="metric-value">{isKR ? Number(stock.week52High).toLocaleString('ko-KR') : fmtNumber(stock.week52High, { decimals: 2 })}</span>
              </div>
              <div className="metric">
                <span className="metric-label">52W L</span>
                <span className="metric-value">{isKR ? Number(stock.week52Low).toLocaleString('ko-KR') : fmtNumber(stock.week52Low, { decimals: 2 })}</span>
              </div>
            </>
          ) : (
            <>
              <div className="metric">
                <span className="metric-label">1M 수익</span>
                <span className="metric-value" style={{ color: stock.return1M > 0 ? '#22c55e' : stock.return1M < 0 ? '#ef4444' : '#9aa3b2' }}>
                  {stock.return1M !== null && stock.return1M !== undefined ? (stock.return1M > 0 ? '+' : '') + stock.return1M.toFixed(2) + '%' : '—'}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">1Y 수익</span>
                <span className="metric-value" style={{ color: stock.return1Y > 0 ? '#22c55e' : stock.return1Y < 0 ? '#ef4444' : '#9aa3b2' }}>
                  {stock.return1Y !== null && stock.return1Y !== undefined ? (stock.return1Y > 0 ? '+' : '') + stock.return1Y.toFixed(2) + '%' : '—'}
                </span>
              </div>
            </>
          )}
          <div className="metric">
            <span className="metric-label">거래량</span>
            <span className="metric-value">{stock.volume}</span>
          </div>
          <div className="metric">
            <span className="metric-label">시총</span>
            <span className="metric-value">{stock.marketCap}</span>
          </div>
          {stock.per !== null && stock.per !== undefined ? (
            <div className="metric">
              <span className="metric-label">PER</span>
              <span className="metric-value">{stock.per.toFixed(2)}</span>
            </div>
          ) : stock.dividendYield ? (
            <div className="metric">
              <span className="metric-label">배당률</span>
              <span className="metric-value" style={{ color: '#f59e0b' }}>{stock.dividendYield.toFixed(2)}%</span>
            </div>
          ) : (
            <div className="metric">
              <span className="metric-label">PER</span>
              <span className="metric-value metric-na">N/A</span>
            </div>
          )}
          {stock.foreignRate ? (
            <div className="metric">
              <span className="metric-label">외인</span>
              <span className="metric-value">{stock.foreignRate.toFixed(2)}%</span>
            </div>
          ) : (
            <div className="metric">
              <span className="metric-label">전일종가</span>
              <span className="metric-value">{isKR ? Number(stock.prevClose).toLocaleString('ko-KR') : fmtNumber(stock.prevClose, { decimals: 2 })}</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ============================================================
// Fear & Greed Gauge
// ============================================================
function FearGreedGauge({ data }) {
  const value = data.value;
  // 0(공포) → 100(탐욕) 반원 게이지
  // 180도 = 왼쪽(공포), 0도 = 오른쪽(탐욕)
  const angle = 180 - (value / 100) * 180; // degree
  const rad = (angle * Math.PI) / 180;
  const cx = 150, cy = 150, r = 110;
  const needleX = cx + r * 0.85 * Math.cos(rad);
  const needleY = cy - r * 0.85 * Math.sin(rad);

  // 라벨 색상
  const getLabelColor = (v) => {
    if (v <= 25) return '#dc2626';
    if (v <= 45) return '#f97316';
    if (v <= 55) return '#eab308';
    if (v <= 75) return '#84cc16';
    return '#22c55e';
  };
  const labelColor = getLabelColor(value);

  // 아크 세그먼트들 (5단계)
  const segments = [
    { from: 0, to: 25, color: '#dc2626', label: 'Extreme Fear' },
    { from: 25, to: 45, color: '#f97316', label: 'Fear' },
    { from: 45, to: 55, color: '#eab308', label: 'Neutral' },
    { from: 55, to: 75, color: '#84cc16', label: 'Greed' },
    { from: 75, to: 100, color: '#22c55e', label: 'Extreme Greed' },
  ];

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((180 - angleInDegrees) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY - radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  return (
    <div className="fg-gauge-panel">
      <div className="fg-header">
        <div className="fg-title">
          <span className="fg-title-main">FEAR &amp; GREED INDEX</span>
          <span className="fg-title-sub">CNN Business · 시장 심리 지표</span>
        </div>
      </div>

      <div className="fg-gauge-wrap">
        <svg viewBox="0 0 300 200" className="fg-gauge-svg">
          {/* 세그먼트 아크 */}
          {segments.map((seg, i) => {
            const startAngle = (seg.from / 100) * 180;
            const endAngle = (seg.to / 100) * 180;
            return (
              <path
                key={i}
                d={describeArc(cx, cy, r, startAngle, endAngle)}
                fill="none"
                stroke={seg.color}
                strokeWidth="18"
                strokeLinecap="butt"
                opacity={value >= seg.from && value <= seg.to ? 1 : 0.22}
              />
            );
          })}
          {/* 눈금 */}
          {[0, 25, 50, 75, 100].map(t => {
            const a = (t / 100) * 180;
            const p1 = polarToCartesian(cx, cy, r - 12, a);
            const p2 = polarToCartesian(cx, cy, r - 2, a);
            return <line key={t} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#5b6473" strokeWidth="1" />;
          })}
          {/* 바늘 */}
          <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#e8eaed" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="7" fill="#0a0d12" stroke="#e8eaed" strokeWidth="2" />
          {/* 라벨 */}
          <text x="30" y="180" fill="#5b6473" fontSize="10" fontFamily="JetBrains Mono">0</text>
          <text x="262" y="180" fill="#5b6473" fontSize="10" fontFamily="JetBrains Mono">100</text>
        </svg>
        <div className="fg-center-stat">
          <div className="fg-value" style={{ color: labelColor }}>{value}</div>
          <div className="fg-label" style={{ color: labelColor }}>{data.label}</div>
        </div>
      </div>

      <div className="fg-timeline">
        <div className="fg-timeline-row">
          <span className="fg-tl-label">전일</span>
          <span className="fg-tl-bar"><span className="fg-tl-fill" style={{ width: data.previous.yesterday + '%', background: getLabelColor(data.previous.yesterday) }} /></span>
          <span className="fg-tl-val">{data.previous.yesterday}</span>
        </div>
        <div className="fg-timeline-row">
          <span className="fg-tl-label">1주 전</span>
          <span className="fg-tl-bar"><span className="fg-tl-fill" style={{ width: data.previous.weekAgo + '%', background: getLabelColor(data.previous.weekAgo) }} /></span>
          <span className="fg-tl-val">{data.previous.weekAgo}</span>
        </div>
        <div className="fg-timeline-row">
          <span className="fg-tl-label">1개월 전</span>
          <span className="fg-tl-bar"><span className="fg-tl-fill" style={{ width: data.previous.monthAgo + '%', background: getLabelColor(data.previous.monthAgo) }} /></span>
          <span className="fg-tl-val">{data.previous.monthAgo}</span>
        </div>
        <div className="fg-timeline-row">
          <span className="fg-tl-label">1년 전</span>
          <span className="fg-tl-bar"><span className="fg-tl-fill" style={{ width: data.previous.yearAgo + '%', background: getLabelColor(data.previous.yearAgo) }} /></span>
          <span className="fg-tl-val">{data.previous.yearAgo}</span>
        </div>
      </div>

      <div className="fg-components">
        <div className="fg-components-header">7개 세부 지표</div>
        {data.components.map((comp, i) => (
          <div className="fg-comp-row" key={i}>
            <div className="fg-comp-info">
              <span className="fg-comp-name">{comp.name}</span>
              <span className="fg-comp-desc">{comp.desc}</span>
            </div>
            <div className="fg-comp-bar">
              <div className="fg-comp-fill" style={{ width: comp.value + '%', background: getLabelColor(comp.value) }} />
            </div>
            <span className="fg-comp-val">{comp.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  DashboardHeader,
  IndexBar,
  Sparkline,
  RSIBar,
  StockCard,
  FearGreedGauge,
  useColors,
  getChangeColor,
});
