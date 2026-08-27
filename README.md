# Our Travel Pocket

Our Travel Pocket은 **2026년 8월 28일 금요일 여행에서 직접 사용할 단일 사용자·단일 기기 실험판**이다. 한 명이 휴대폰의 같은 브라우저에서 하나의 활성 여행, 일행, 경비와 통화별 정산을 관리한다.

## 현재 상태

**WP-04 배포 준비** — 단일 활성 여행, 일행·경비 CRUD, 통화별 집계와 최소 송금 UI가 구현되어 있다. 데이터는 서버로 전송하지 않는다.

> 데이터는 사용 중인 브라우저의 localStorage에만 저장된다. 브라우저 데이터 삭제, 시크릿 모드 종료, 다른 브라우저나 다른 기기에서는 유지되지 않으며 백업과 복구를 지원하지 않는다.

## 문서

- [PRD.md](./PRD.md): 실험판 제품 범위와 수용 기준
- [ARCHITECTURE.md](./ARCHITECTURE.md): 클라이언트 구조, 저장 스키마와 계산 규칙
- [BACKLOG.md](./BACKLOG.md): WP-00~WP-04 구현 순서
- [AGENTS.md](./AGENTS.md): 향후 Codex 개발 규칙

## 로컬 실행과 검증

Node.js 24와 npm 11 환경에서 실행한다.

```bash
npm install
npm run dev
```

전체 검증은 다음 명령으로 실행한다.

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

E2E는 360px Android Chrome(Chromium)과 iPhone Safari(WebKit) 프로필을 사용한다. 최초 실행 전 브라우저가 없다면 `npx playwright install chromium webkit`을 실행한다.

## Vercel 배포 준비

Vercel 프로젝트와 도메인은 아직 지정하지 않았다. 프로젝트가 확정되면 Vercel CLI에서 저장소를 연결하고 production build를 확인한 뒤 Preview 배포를 검증한다. 환경 변수나 서버 저장소는 필요하지 않다.

```bash
npm run build
npx vercel link
npx vercel
```

Production 배포(`npx vercel --prod`)는 사용자 승인 후에만 실행한다. Preview와 Production은 서로 다른 origin이므로 각 환경의 localStorage 데이터도 공유되지 않는다.

## 기술 스택과 구현 순서

Node.js 24 LTS, Next.js App Router, TypeScript strict, Tailwind CSS, React Hook Form, Zod, Vitest, Playwright, localStorage, Vercel을 사용한다.

모바일 앱 셸 → 금액·분할·최소 송금 알고리즘 → localStorage와 여행·일행·경비 관리 → 집계·정산 UI → 모바일 E2E 및 배포 준비 순서로 구현했다. 실제 배포는 사용자 승인 이후에만 수행한다.
