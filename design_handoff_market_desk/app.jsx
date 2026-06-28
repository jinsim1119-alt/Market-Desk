// 메인 앱
const { useState, useEffect } = React;

function App() {
  const [t, setTweak] = useTweaks({
    theme: 'dark',
    colorConvention: 'kr',
    density: 'comfortable',
    sortBy: 'default',
  });

  // data.json을 매번 fresh하게 읽음 (cache-bust)
  const [data, setData] = useState(window.MARKET_DATA);
  const [loadStatus, setLoadStatus] = useState('idle'); // idle | loading | ok | error

  useEffect(() => {
    setLoadStatus('loading');
    fetch('data.json?_=' + Date.now())
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(json => {
        setData(json);
        setLoadStatus('ok');
        // 마지막 성공한 데이터를 localStorage에 캐싱 (오프라인 대비)
        try { localStorage.setItem('marketdesk:lastData', JSON.stringify(json)); } catch {}
      })
      .catch(err => {
        console.warn('data.json fetch failed, using fallback:', err);
        // 1순위: localStorage 캐시 → 2순위: 번들된 fallback
        try {
          const cached = localStorage.getItem('marketdesk:lastData');
          if (cached) {
            setData(JSON.parse(cached));
            setLoadStatus('cached');
            return;
          }
        } catch {}
        setLoadStatus('fallback');
      });
  }, []);

  const colors = useColors(t.colorConvention);

  if (!data) {
    return (
      <div className="app theme-dark loading-shell">
        <div className="loading-text">데이터 로딩 중…</div>
      </div>
    );
  }

  // 정렬
  const sortedStocks = [...data.stocks];
  if (t.sortBy === 'change-desc') {
    sortedStocks.sort((a, b) => b.changePct - a.changePct);
  } else if (t.sortBy === 'rsi-desc') {
    sortedStocks.sort((a, b) => (b.rsi || 0) - (a.rsi || 0));
  } else if (t.sortBy === 'name') {
    sortedStocks.sort((a, b) => a.nameKr.localeCompare(b.nameKr, 'ko'));
  }

  return (
    <div className={`app theme-${t.theme}`}>
      <DashboardHeader meta={data.meta} loadStatus={loadStatus} />
      <IndexBar indices={data.indices} colors={colors} />

      <main className="dash-main">
        <section className="stocks-section">
          <div className="section-head">
            <h2 className="section-title">
              PORTFOLIO <span className="section-count">{data.stocks.length}</span>
              <span className="section-tag-us">US</span>
            </h2>
            <div className="section-meta">
              <span className="meta-item">기준: {data.meta.asOf}</span>
              <span className="meta-divider" />
              <span className="meta-item">RSI(14) · Wilder</span>
            </div>
          </div>
          <div className="stocks-grid">
            {sortedStocks.map(stock => (
              <StockCard
                key={stock.ticker}
                stock={stock}
                colors={colors}
                density={t.density}
              />
            ))}
          </div>

          {data.krStocks && data.krStocks.length > 0 && (
            <>
              <div className="section-head section-head-kr">
                <h2 className="section-title">
                  KR 반도체 <span className="section-count">{data.krStocks.length}</span>
                  <span className="section-tag-kr">KR</span>
                </h2>
                <div className="section-meta">
                  <span className="meta-item">KOSPI</span>
                </div>
              </div>
              <div className="stocks-grid stocks-grid-kr">
                {data.krStocks.map(stock => (
                  <StockCard
                    key={stock.ticker}
                    stock={stock}
                    colors={colors}
                    density={t.density}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="fg-section">
          <FearGreedGauge data={data.fearGreed} />
        </aside>
      </main>

      <footer className="dash-footer">
        <span>출처: {data.meta.source} · 기준: {data.meta.asOf} · ※ 美 채권금리는 추정값(EST)</span>
        <span className="footer-version">MARKETDESK v1.1</span>
      </footer>

      <TweaksPanel title="Tweaks">
        <TweakSection title="외관">
          <TweakRadio
            tweak="theme"
            label="테마"
            value={t.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'dark', label: '다크' },
              { value: 'light', label: '라이트' },
            ]}
          />
          <TweakRadio
            tweak="colorConvention"
            label="등락 색상"
            value={t.colorConvention}
            onChange={(v) => setTweak('colorConvention', v)}
            options={[
              { value: 'us', label: '美 ↑녹 ↓적' },
              { value: 'kr', label: '韓 ↑적 ↓청' },
            ]}
          />
          <TweakRadio
            tweak="density"
            label="정보 밀도"
            value={t.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfort' },
            ]}
          />
        </TweakSection>

        <TweakSection title="정렬">
          <TweakSelect
            tweak="sortBy"
            label="종목 정렬"
            value={t.sortBy}
            onChange={(v) => setTweak('sortBy', v)}
            options={[
              { value: 'default', label: '기본 순서' },
              { value: 'change-desc', label: '등락률 ↓' },
              { value: 'rsi-desc', label: 'RSI ↓' },
              { value: 'name', label: '가나다순' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
