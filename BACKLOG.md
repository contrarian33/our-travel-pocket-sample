# Our Travel Pocket 실험판 백로그

## 공통 규칙

- WP-00부터 순서대로 한 Codex 세션에 하나의 WP만 구현·검토한다.
- 각 WP는 PRD, ARCHITECTURE, AGENTS와 선행 결과를 확인한 뒤 시작한다.
- 공통 검증은 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`이다.
- Playwright 구성 이후 관련 변경에는 `npm run test:e2e`를 추가한다.
- 실제 배포, 커밋과 푸시는 사용자 승인 전까지 수행하지 않는다.

## WP-00: Next.js 프로젝트 기반과 모바일 앱 셸

**목표:** strict Next.js 기반과 hydration-safe 모바일 셸을 만든다.

**범위:** App Router, TypeScript strict, Tailwind, React Hook Form, Zod, Vitest, lint/typecheck/build 스크립트, 360px 모바일 내비게이션과 중립 로딩 셸, 클라이언트 마운트 경계.

**제외 범위:** 실제 localStorage 모델, 여행/경비 기능, 계산 알고리즘, 완성 화면, 배포.

**완료 조건:** 서버와 첫 클라이언트 렌더가 동일한 셸을 만들고 브라우저 API를 서버에서 참조하지 않으며 공통 검증이 성공한다.

**검증 명령:** `npm run lint && npm run typecheck && npm run test && npm run build`

## WP-01: 금액·균등 분할·최소 송금 알고리즘 및 Vitest

**목표:** UI와 저장소보다 먼저 정수 문자열/`bigint` 경계와 정확한 계산 규칙을 고정한다.

**범위:** KRW/JPY 정수 입력, USD 최대 2자리 입력과 센트 왕복, 최소 단위 문자열, 스냅샷 분할, 결제자 나머지, 통화 분리, 최대 10명 bitmask 기반 정확 최소 송금, Vitest 불변식·최적성 테스트.

**제외 범위:** localStorage 접근, React UI, 데이터 CRUD, Vercel.

**완료 조건:** 금액 계산에 부동소수점이 없고 JSON DTO에 `bigint`가 없으며 분할·잔액·최소 건수·결정성 불변식이 통과한다.

**검증 명령:** `npm run test -- money split settlement && npm run lint && npm run typecheck && npm run build`

## WP-02: localStorage 저장소와 여행·일행·경비 관리

**목표:** 하나의 활성 여행과 전체 CRUD를 버전된 로컬 저장소에 안전하게 보존한다.

**범위:** `our-travel-pocket:v1`, v1 Zod 스키마, 마운트 후 로드, 없음/손상/쓰기 실패/초기화 상태, 여행 설정·수정, 최대 10명 일행 CRUD, 참조 삭제 차단, 공동/개인 경비 CRUD, 공동 경비 생성 시 전체 `participantIds` 스냅샷과 수정 시 유지, 필터, 삭제/전체 초기화 확인, 재실행 복원.

**제외 범위:** 집계·정산 완성 UI, 동기화, 백업/복구/내보내기, 배포.

**완료 조건:** 모든 읽기가 Zod 검증을 거치고 손상 데이터가 앱을 중단시키지 않으며 CRUD와 스냅샷·참조 제한·금액 저장·필터·초기화 정책이 테스트된다.

**검증 명령:** `npm run test -- storage trip participants expenses && npm run lint && npm run typecheck && npm run build`

## WP-03: 집계·정산·산출 근거 모바일 UI

**목표:** 저장된 공동 경비에서 현장에서 이해 가능한 집계와 최신 정산 결과를 제공한다.

**범위:** 결제자·통화별 집계, 통화별 최소 송금, 항목별 스냅샷 인원·기본 몫·결제자 나머지·개별 부담, 개인 지출 제외, 빈/오류 상태, 경비 변경 직후 재계산, 360px 모바일 상호작용.

**제외 범위:** 실제 송금, 완료 상태, 환율, 통화 간 합계, 네트워크 데이터 전송.

**완료 조건:** 화면 결과가 WP-01 순수 함수와 일치하고 스냅샷 및 통화 경계를 유지하며 경비 변경 직후 최신 결과가 표시된다.

**검증 명령:** `npm run test -- aggregation settlement-ui && npm run lint && npm run typecheck && npm run build`

## WP-04: 전체 흐름 Playwright, 모바일 사용성, Vercel 배포 준비

**목표:** 금요일 현장 흐름과 데이터 유실 안내를 모바일 브라우저 조건으로 검증하고 승인 가능한 배포 산출물을 준비한다.

**범위:** Playwright 구성, 360px 핵심 E2E, 새로고침/재실행 복원, 손상 데이터/초기화, 키보드·포커스·터치 영역·가로 스크롤 점검, 한국어 문구, Vercel 빌드 및 배포 절차 문서화.

**제외 범위:** 사용자 승인 없는 실제 배포, 계정/서버/DB, 범위 밖 기능, 자동 백업.

**완료 조건:** 핵심 흐름과 회귀 테스트, 공통 검증, production build가 성공하고 데이터 유실 위험이 초기 설정과 여행 정보 화면에 표시된다. 배포는 실행하지 않는다.

**검증 명령:** `npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build`

