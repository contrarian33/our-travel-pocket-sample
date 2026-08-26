import { describe, expect, it } from "vitest";
import { aggregateSharedExpenses, buildSharedExpenseDetails } from "./aggregation";

const expenses = [
  { id: "e2", title: "숙소", currency: "KRW" as const, amountMinor: "10", payerParticipantId: "a", kind: "shared" as const, participantIds: ["a", "b", "c"] },
  { id: "e1", title: "기차", currency: "KRW" as const, amountMinor: "20", payerParticipantId: "a", kind: "shared" as const, participantIds: ["a", "b"] },
  { id: "e3", title: "간식", currency: "USD" as const, amountMinor: "250", payerParticipantId: "b", kind: "shared" as const, participantIds: ["a", "b"] },
  { id: "e4", title: "개인 쇼핑", currency: "KRW" as const, amountMinor: "999", payerParticipantId: "a", kind: "personal" as const, participantIds: [] },
];

describe("공동 경비 집계", () => {
  it("개인 지출을 제외하고 결제자와 통화별 합계 및 구성 경비를 반환한다", () => {
    expect(aggregateSharedExpenses(expenses)).toEqual([
      { participantId: "a", currency: "KRW", amountMinor: "30", expenseIds: ["e1", "e2"] },
      { participantId: "b", currency: "USD", amountMinor: "250", expenseIds: ["e3"] },
    ]);
  });
  it("항목별 스냅샷으로 기본 몫, 결제자 나머지와 부담 합을 계산한다", () => {
    const lodging = buildSharedExpenseDetails(expenses).find((detail) => detail.id === "e2");
    expect(lodging).toMatchObject({ baseShareMinor: "3", payerRemainderMinor: "1", participantIds: ["a", "b", "c"] });
    expect(lodging?.shares.reduce((sum, share) => sum + BigInt(share.amountMinor), 0n)).toBe(10n);
  });
});
