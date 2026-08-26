# Our Travel Pocket

Our Travel Pocket은 **2026년 8월 28일 금요일 여행에서 직접 사용할 단일 사용자·단일 기기 실험판**이다. 한 명이 휴대폰의 같은 브라우저에서 하나의 활성 여행, 일행, 경비와 통화별 정산을 관리한다.

## 현재 상태

**planning** — 현재는 문서만 있으며 설치하거나 실행할 애플리케이션, 패키지 또는 설정은 아직 없다.

> 데이터는 사용 중인 브라우저의 localStorage에만 저장된다. 브라우저 데이터 삭제, 시크릿 모드 종료, 다른 브라우저나 다른 기기에서는 유지되지 않으며 백업과 복구를 지원하지 않는다.

## 문서

- [PRD.md](./PRD.md): 실험판 제품 범위와 수용 기준
- [ARCHITECTURE.md](./ARCHITECTURE.md): 클라이언트 구조, 저장 스키마와 계산 규칙
- [BACKLOG.md](./BACKLOG.md): WP-00~WP-04 구현 순서
- [AGENTS.md](./AGENTS.md): 향후 Codex 개발 규칙

## 예정 기술 스택과 순서

Next.js App Router, TypeScript strict, Tailwind CSS, React Hook Form, Zod, Vitest, Playwright, localStorage, Vercel을 사용한다.

모바일 앱 셸 → 금액·분할·최소 송금 알고리즘 → localStorage와 여행·일행·경비 관리 → 집계·정산 UI → 모바일 E2E 및 배포 준비 순서로 구현한다. 실제 배포는 사용자 승인 이후에만 수행한다.

