# MARKET DESK

> 개인용 포트폴리오 대시보드. 매일 06:00 KST 자동 업데이트. PWA 앱.

## 📱 무엇인가요?

- **종목**: SOXL, QLD, NVDA, GOOGL, TSLA, SPCX, TLTW, 473330(SOL 美30Y커버드콜), 삼성전자, SK하이닉스
- **인덱스**: S&P 500, NASDAQ 100, PHLX 반도체, USD/KRW, 美 10Y/30Y, KOSPI, KOSDAQ
- **지표**: CNN Fear & Greed, RSI(14) Wilder, 등락률, 52주 H/L
- **데이터 출처**: Npay증권 · Yahoo Finance · CNN Business

## 🚀 첫 셋업 (5분)

### 1. GitHub 저장소 만들기

1. github.com 로그인 → 우상단 `+` → `New repository`
2. 이름: `marketdesk` (원하는 이름)
3. **Public** 선택 (Private은 무료 Pages 호스팅 불가)
4. `Add a README` 체크 해제
5. `Create repository`

### 2. 이 프로젝트를 저장소에 푸시

이 Designer 프로젝트의 **Download** 버튼으로 zip 받기 → 압축 풀고 → 터미널에서:

```bash
cd <압축푼폴더>
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/marketdesk.git
git push -u origin main
```

### 3. GitHub Pages 활성화

저장소 페이지에서:
1. `Settings` 탭 → 좌측 `Pages` 메뉴
2. **Source**: `GitHub Actions` 선택
3. 저장

### 4. GitHub Actions 권한 허용

1. `Settings` → `Actions` → `General`
2. **Workflow permissions**: `Read and write permissions` 체크
3. `Allow GitHub Actions to create and approve pull requests` 체크
4. `Save`

### 5. 첫 데이터 수집 수동 실행

1. `Actions` 탭
2. 좌측에서 `Daily Market Data Update` 선택
3. 우측 `Run workflow` 버튼 클릭 → 녹색 버튼 한 번 더

→ 2분 뒤 `data.json`이 자동 갱신되고 GitHub Pages에 배포됨.

### 6. 사이트 URL 확인

`Settings` → `Pages`에 나오는 URL: `https://<YOUR_USERNAME>.github.io/marketdesk/`

### 7. 폰에서 홈화면에 추가

**iOS (사파리):**
1. 사파리에서 URL 접속
2. 하단 공유 버튼 → `홈 화면에 추가`
3. 이름 확인 → `추가`

**Android (크롬):**
1. 크롬에서 URL 접속
2. 우상단 `⋮` → `홈 화면에 추가` (또는 `앱 설치`)

→ 홈화면에 **MD** 아이콘 생김. 누르면 풀스크린으로 실행됨.

## ⏰ 매일 06:00 KST 자동 업데이트

`.github/workflows/daily-update.yml`에 정의됨. UTC 21:00 = KST 06:00.

GitHub cron은 ±5~15분 지연 있을 수 있음.

## 🛠 수동으로 데이터 갱신

`Actions` 탭 → `Daily Market Data Update` → `Run workflow`

## 📝 종목 추가/제거

`scripts/fetch-data.mjs` 상단의 `PORTFOLIO` 배열 수정 후 푸시.

```js
const PORTFOLIO = [
  { ticker: 'AAPL', market: 'foreign', symbol: 'AAPL.O', nameKr: '애플', exchange: 'NASDAQ', currency: 'USD' },
  // ...
];
```

종목 심볼 찾는 법: m.stock.naver.com 에서 종목 검색 → URL에 표시되는 심볼 사용
- 미국주식: `NVDA.O`(나스닥), `TLT.O`(나스닥 ETF), `SOXL`(아멕스 ETF)
- 한국주식: 6자리 종목코드 (예: `005930`)

## 🎨 색상/테마 변경

페이지 우하단 `Tweaks` 버튼:
- 다크 ↔ 라이트
- 등락 색상: 한국식(↑빨강) ↔ 미국식(↑녹색)
- 종목 정렬

## 🔒 보안

- 검색엔진 차단 (`robots.txt` + `noindex` 메타)
- URL을 모르는 사람은 접근 불가
- 단, 누가 URL을 알면 볼 수 있음 — 민감정보 추가 시 비밀번호 게이트 추가 권장

## 🐛 문제 해결

| 증상 | 해결 |
|---|---|
| 데이터가 안 보임 | Actions 탭에서 워크플로 성공 확인 |
| 모바일에서 옛 데이터 | 홈화면 아이콘 길게 누르고 삭제 → 다시 추가 (캐시 리셋) |
| 종목이 빠짐 | Actions 로그에서 "no data for XXX" 확인 → 심볼 수정 |
| 시간이 안 맞음 | 워크플로는 UTC 기준. 06:00 KST = UTC 21:00 (전날) |

## 📂 파일 구조

```
.
├── index.html                       # 메인 페이지
├── app.jsx                          # React 앱
├── components.jsx                   # UI 컴포넌트
├── tweaks_panel.jsx                 # 설정 패널
├── styles.css                       # 스타일
├── data.json                        # 매일 자동 갱신되는 데이터
├── data.js                          # fallback 데이터 (오프라인용)
├── manifest.webmanifest             # PWA 매니페스트
├── sw.js                            # Service Worker
├── robots.txt                       # 검색엔진 차단
├── icons/                           # PWA 아이콘
└── scripts/
    └── fetch-data.mjs               # 데이터 수집 스크립트
└── .github/workflows/
    ├── daily-update.yml             # 매일 06:00 KST 자동 실행
    └── deploy-pages.yml             # main 푸시 시 즉시 배포
```

---

⚠️ **투자 참고용 — 실거래 의사결정에 사용 금지.**
