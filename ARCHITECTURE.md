# Our Travel Pocket 실험판 아키텍처

## 기술 방향

Next.js App Router, TypeScript strict, Tailwind CSS, React Hook Form, Zod, Vitest, Playwright를 사용한다. 브라우저 localStorage가 유일한 영속 저장소이며 Vercel은 웹 앱 전달에만 사용한다. 서버 데이터 저장, 사용자 계정, 소유권/권한 계층과 외부 동기화는 설계하지 않는다.

## 클라이언트 중심 구조

```text
app/                   정적 레이아웃과 실험판 진입 화면
components/            모바일 화면, 폼, 대화상자
lib/domain/
  money.ts             화면 금액 ↔ 최소 단위 문자열
  split.ts             균등 분할
  settlement.ts        정확한 최소 송금
lib/storage/
  schema.ts            저장 DTO와 Zod 스키마
  repository.ts        마운트 후 localStorage 읽기/쓰기/초기화
  migrations.ts        향후 버전 변환 진입점
lib/state/             단일 활성 여행 상태와 파생 데이터
tests/                 Vitest 및 Playwright
```

서버 렌더 결과는 브라우저 저장 상태를 가정하지 않는다. 클라이언트 마운트 후 저장소 어댑터가 데이터를 로드한다. 검증된 저장 DTO가 원본 상태이고 필터, 집계, 분할 근거와 정산은 저장하지 않는 파생값이다.

## 저장 키와 버전 관리

- 키는 `our-travel-pocket:v1`이다.
- 키 버전과 내부 `schemaVersion: 1`이 모두 일치해야 한다.
- v1 이외 데이터는 지원 migration이 생기기 전까지 묵시적으로 변환하지 않고 손상/미지원 상태와 초기화 선택지를 표시한다.
- 쓰기는 Zod 검증을 통과한 DTO 전체를 `JSON.stringify`해 한 키에 저장한다.
- 읽기는 `getItem → JSON.parse → Zod safeParse` 순서이며 실패를 앱 전체로 전파하지 않는다.
- 저장 실패 시 기존 저장값을 가능한 한 유지하고 성공으로 표시하지 않는다.
- `loading | empty | ready | corrupt | writeError`를 구분한다.

## v1 localStorage 스키마

```ts
type StoredStateV1 = {
  schemaVersion: 1;
  trip: {
    id: string;
    name: string;
    country: string | null;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    participants: Array<{
      id: string;
      displayName: string;
    }>;
    expenses: Array<{
      id: string;
      title: string;
      expenseDate: string; // YYYY-MM-DD
      currency: "KRW" | "JPY" | "USD";
      amountMinor: string; // 양의 최소 단위 10진 정수
      payerParticipantId: string;
      kind: "shared" | "personal";
      participantIds: string[];
    }>;
  };
};
```

- 단일 활성 여행이므로 `trip` 배열을 두지 않는다.
- ID는 브라우저에서 생성하며 저장 데이터 안에서 유일해야 한다.
- 공동 경비의 `participantIds`는 생성 시점 전체 일행 ID의 중복 없는 스냅샷이고 결제자 ID를 포함한다.
- 공동 경비 수정은 스냅샷을 유지한다. 일부 선택이나 최신 인원으로 자동 교체하지 않는다.
- 개인 지출의 `participantIds`는 빈 배열이다.
- 일행 ID는 어떤 경비의 결제자 또는 `participantIds`에 남아 있는 동안 삭제할 수 없다.
- Zod 교차 검증으로 날짜, 최대 10명, ID 참조, 이름 유일성, 통화/금액, kind별 스냅샷 불변식을 검사한다.
- **TBD:** 텍스트 최대 길이, 금액 상한, 표시 이름 정규화 상세. WP-02 전에 확정한다.

## 금액 입력·직렬화·계산 경계

### 화면 입력

- KRW/JPY는 자릿수만 있는 양의 정수 문자열이다.
- USD는 소수점 앞 한 자리 이상, 소수점 뒤 최대 두 자리인 양수 문자열이다.
- 지수 표기, 부호, 구분 쉼표와 셋째 소수 자리는 거부한다.

### 저장

- `amountMinor`는 선행 0을 정규화한 양의 10진 정수 문자열이다.
- KRW는 원, JPY는 엔, USD는 센트이다. USD `12`, `12.3`, `12.34`는 각각 `"1200"`, `"1230"`, `"1234"`로 저장한다.
- `JSON.stringify` 대상에는 `bigint`가 절대 포함되지 않는다.

### 계산과 표시

- 계산 진입 시 검증된 `amountMinor`만 `BigInt(amountMinor)`로 변환한다.
- 합계, 나눗셈, 잔액과 송금 계산은 전부 `bigint`이며 부동소수점 `number`를 사용하지 않는다.
- 계산 결과는 저장하지 않는다. 저장 경계가 필요하면 다시 10진 문자열로 변환한다.
- USD 화면 표시는 센트 정수에서 정확히 두 자리 소수로 복원한다.

## 균등 분할

공동 경비 금액 `A`, 저장된 `participantIds` 길이 `N`, 결제자 `P`에 대해 다음을 수행한다.

1. `q = A / N`, `r = A % N`을 `bigint`로 계산한다.
2. 비결제자 부담은 `q`, 결제자 부담은 `q + r`이다.
3. 결제자에게만 실제 결제액 `A`를 배정하고 일행별 잔액에 `paid - owed`를 더한다.
4. 부담 합은 `A`, 잔액 합은 0이어야 한다.

개인 지출은 계산 입력에서 제외한다. 이후 추가된 일행은 과거 스냅샷에 없으므로 해당 경비를 부담하지 않는다.

## 통화별 정확한 최소 송금

일행이 최대 10명이므로 각 통화를 독립적으로 정확 탐색한다.

1. 공동 경비를 통화별로 나누고 각 스냅샷으로 일행별 순잔액을 합산한다.
2. 0 잔액을 제거하고 음수는 송금자, 양수는 수령자로 나눈다.
3. 0이 아닌 잔액 집합을 합이 0인 서로소 부분집합의 최대 개수로 나누는 memoized bitmask 탐색을 수행한다.
4. `m`명과 최대 `k`개 0합 그룹의 전역 최소 송금 건수는 `m - k`이다.
5. 각 그룹에서 ID 기반 결정적 순서와 완전 탐색/백트래킹으로 그 건수의 송금 목록을 구성한다.
6. 송금 후 모든 잔액 0, 양수 금액, 동일 통화, 최소 건수와 결정성을 검증한다.

경비 변경이 저장되면 파생 집계와 정산을 즉시 다시 계산한다.

## 상태와 UI 책임

- React Hook Form은 편집 입력을 담당하고 Zod를 통과한 명령만 상태 변경 함수로 보낸다.
- 변경은 불변 업데이트 → 전체 DTO 검증 → localStorage 저장 → 성공 UI 반영 순서다.
- 경비 삭제, 참조되지 않은 일행 삭제와 전체 초기화는 확인을 거친다.
- 손상된 저장값이나 사용자 입력을 `innerHTML`로 출력하지 않는다.

## SSR 및 hydration 안전

- 모듈 최상위, Server Component와 서버 렌더링 중 `window` 또는 `localStorage`를 참조하지 않는다.
- 저장소 접근은 Client Component 마운트 이후 effect 또는 클라이언트 이벤트에서만 한다.
- 첫 서버/클라이언트 렌더는 동일한 중립 로딩 셸이다.
- 로드 완료 전 초기 설정이나 저장 여행을 추측해 렌더링하지 않는다.

## 오류와 데이터 유실 대응

- JSON 파싱·스키마 검증 실패 시 한국어 오류와 전체 초기화만 제공하며 일부를 임의 복구하거나 덮어쓰지 않는다.
- 초기 설정과 여행 정보 화면에 브라우저 데이터 삭제, 시크릿 모드, 다른 기기에서 데이터가 유지되지 않음을 표시한다.
- 전체 초기화는 확인 후 정확한 v1 키만 제거한다.
- 백업, 복구, 동기화와 내보내기는 제공하지 않는다.

## 테스트 전략

- Vitest: 통화 입력 왕복, 잘못된 금액, `bigint` 직렬화 방지, 분할 불변식, 스냅샷 유지, 개인 지출 제외, 최소 송금 최적성/결정성.
- 저장소: 없음/정상/손상/미지원 버전, Zod 재검증, 쓰기 실패, 초기화와 참조 삭제 제한.
- 상태: CRUD 후 파생 결과 갱신, 이후 일행 추가 시 과거 경비 불변.
- Playwright: 모바일에서 초기 설정부터 일행·경비·집계·정산·재실행 복원·손상 초기화·전체 초기화까지 검증.

## 배포

- Next.js 결과를 Vercel에서 제공하며 런타임 영속 서비스를 두지 않는다.
- Preview와 Production 모두 해당 브라우저의 localStorage만 사용한다.
- 실제 배포는 사용자 승인 전까지 수행하지 않는다.
- **TBD:** 목표 브라우저 버전과 Vercel 프로젝트/도메인. WP-04 전 확정한다.

