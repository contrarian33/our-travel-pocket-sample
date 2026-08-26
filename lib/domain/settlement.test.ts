import { describe, expect, it } from "vitest";

import { DomainError } from "./errors";
import { calculateBalances, calculateMinimumTransfers, settleExpenses } from "./settlement";
import type { CurrencyBalance, SharedExpense, Transfer } from "./types";

const expense = (overrides: Partial<SharedExpense> = {}): SharedExpense => ({
  id: "expense-1", currency: "KRW", amountMinor: "100", payerParticipantId: "a", participantIds: ["a", "b"], ...overrides,
});

function applyTransfers(balances: readonly CurrencyBalance[], transfers: readonly Transfer[]) {
  const result = new Map(balances.map((balance) => [`${balance.currency}:${balance.participantId}`, BigInt(balance.amountMinor)]));
  for (const transfer of transfers) {
    const sender = `${transfer.currency}:${transfer.senderParticipantId}`;
    const receiver = `${transfer.currency}:${transfer.receiverParticipantId}`;
    const amount = BigInt(transfer.amountMinor);
    result.set(sender, (result.get(sender) ?? 0n) + amount);
    result.set(receiver, (result.get(receiver) ?? 0n) - amount);
  }
  return result;
}

describe("settlement", () => {
  it("2명 공동 경비를 한 건으로 정산한다", () => {
    expect(settleExpenses([expense()])).toEqual([
      { currency: "KRW", senderParticipantId: "b", receiverParticipantId: "a", amountMinor: "50" },
    ]);
  });

  it("3명 이상의 여러 경비를 상계한다", () => {
    const expenses = [
      expense({ id: "1", amountMinor: "90", payerParticipantId: "a", participantIds: ["a", "b", "c"] }),
      expense({ id: "2", amountMinor: "60", payerParticipantId: "b", participantIds: ["a", "b", "c"] }),
    ];
    expect(settleExpenses(expenses)).toEqual([
      { currency: "KRW", senderParticipantId: "c", receiverParticipantId: "a", amountMinor: "40" },
      { currency: "KRW", senderParticipantId: "c", receiverParticipantId: "b", amountMinor: "10" },
    ]);
  });

  it("잔액이 모두 0이면 송금이 없다", () => {
    expect(calculateMinimumTransfers([{ currency: "KRW", participantId: "a", amountMinor: "0" }])).toEqual([]);
  });

  it("통화를 섞지 않고 각각 정산한다", () => {
    const expenses = (["KRW", "JPY", "USD"] as const).map((currency, index) =>
      expense({ id: String(index), currency, amountMinor: "200", payerParticipantId: "a" }),
    );
    expect(settleExpenses(expenses)).toEqual([
      { currency: "JPY", senderParticipantId: "b", receiverParticipantId: "a", amountMinor: "100" },
      { currency: "KRW", senderParticipantId: "b", receiverParticipantId: "a", amountMinor: "100" },
      { currency: "USD", senderParticipantId: "b", receiverParticipantId: "a", amountMinor: "100" },
    ]);
  });

  it("경비마다 저장된 서로 다른 스냅샷만 부담한다", () => {
    const oldExpense = expense({ id: "old", amountMinor: "90", participantIds: ["a", "b"] });
    const newExpense = expense({ id: "new", amountMinor: "90", participantIds: ["a", "b", "c"] });
    const oldBalances = calculateBalances([oldExpense]);
    expect(oldBalances.some((balance) => balance.participantId === "c")).toBe(false);
    expect(calculateBalances([oldExpense, newExpense])).toEqual([
      { currency: "KRW", participantId: "a", amountMinor: "105" },
      { currency: "KRW", participantId: "b", amountMinor: "-75" },
      { currency: "KRW", participantId: "c", amountMinor: "-30" },
    ]);
  });

  it("단순 greedy가 4건을 만드는 반례에서도 전역 최소 3건을 찾는다", () => {
    const balances: CurrencyBalance[] = [
      { currency: "KRW", participantId: "s1", amountMinor: "-6" },
      { currency: "KRW", participantId: "s2", amountMinor: "-4" },
      { currency: "KRW", participantId: "s3", amountMinor: "-4" },
      { currency: "KRW", participantId: "r1", amountMinor: "8" },
      { currency: "KRW", participantId: "r2", amountMinor: "6" },
    ];
    const transfers = calculateMinimumTransfers(balances);
    expect(transfers).toHaveLength(3);
    expect([...applyTransfers(balances, transfers).values()].every((amount) => amount === 0n)).toBe(true);
  });

  it("동일 입력과 순서 변경에 같은 정규화 결과를 반환한다", () => {
    const balances: CurrencyBalance[] = [
      { currency: "USD", participantId: "d", amountMinor: "-5" },
      { currency: "USD", participantId: "a", amountMinor: "5" },
      { currency: "USD", participantId: "c", amountMinor: "-7" },
      { currency: "USD", participantId: "b", amountMinor: "7" },
    ];
    expect(calculateMinimumTransfers(balances)).toEqual(calculateMinimumTransfers([...balances].reverse()));
  });

  it("최대 10명에서 양수 송금만으로 모든 잔액을 0으로 만든다", () => {
    const balances: CurrencyBalance[] = Array.from({ length: 10 }, (_, index) => ({
      currency: "JPY", participantId: `p${index}`, amountMinor: index < 5 ? "-1" : "1",
    }));
    const transfers = calculateMinimumTransfers(balances);
    expect(transfers).toHaveLength(5);
    expect(transfers.every((transfer) => BigInt(transfer.amountMinor) > 0n)).toBe(true);
    expect([...applyTransfers(balances, transfers).values()].every((amount) => amount === 0n)).toBe(true);
    expect(() => JSON.stringify(transfers)).not.toThrow();
  });

  it("10명을 초과하면 명시적 오류로 거부한다", () => {
    const balances: CurrencyBalance[] = Array.from({ length: 12 }, (_, index) => ({
      currency: "KRW", participantId: `p${String(index).padStart(2, "0")}`, amountMinor: index < 6 ? "-1" : "1",
    }));
    expect(() => calculateMinimumTransfers(balances)).toThrowError(
      expect.objectContaining<Partial<DomainError>>({ code: "TOO_MANY_PARTICIPANTS" }),
    );
  });

  it("합이 0이 아닌 잔액은 거부한다", () => {
    expect(() => calculateMinimumTransfers([{ currency: "KRW", participantId: "a", amountMinor: "1" }])).toThrowError(
      expect.objectContaining<Partial<DomainError>>({ code: "UNBALANCED_BALANCES" }),
    );
  });
});
