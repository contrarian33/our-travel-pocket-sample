import { describe, expect, it } from "vitest";

import { DomainError } from "./errors";
import { splitEqually } from "./split";

describe("splitEqually", () => {
  it("나누어떨어지는 금액을 균등 분할한다", () => {
    expect(splitEqually({ amountMinor: "300", payerParticipantId: "a", participantIds: ["a", "b", "c"] }).shares)
      .toEqual([
        { participantId: "a", amountMinor: "100" },
        { participantId: "b", amountMinor: "100" },
        { participantId: "c", amountMinor: "100" },
      ]);
  });

  it("나머지를 결제자에게만 배정한다", () => {
    const result = splitEqually({ amountMinor: "10", payerParticipantId: "b", participantIds: ["c", "b", "a"] });
    expect(result.baseShareMinor).toBe("3");
    expect(result.payerRemainderMinor).toBe("1");
    expect(result.shares).toEqual([
      { participantId: "a", amountMinor: "3" },
      { participantId: "b", amountMinor: "4" },
      { participantId: "c", amountMinor: "3" },
    ]);
  });

  it("금액보다 인원수가 많아도 결제자 부담과 불변식을 유지한다", () => {
    const result = splitEqually({ amountMinor: "2", payerParticipantId: "b", participantIds: ["a", "b", "c"] });
    expect(result.shares).toEqual([
      { participantId: "a", amountMinor: "0" },
      { participantId: "b", amountMinor: "2" },
      { participantId: "c", amountMinor: "0" },
    ]);
    expect(result.shares.reduce((sum, share) => sum + BigInt(share.amountMinor), 0n)).toBe(2n);
    const balanceSum = result.shares.reduce(
      (sum, share) => sum + (share.participantId === "b" ? 2n : 0n) - BigInt(share.amountMinor),
      0n,
    );
    expect(balanceSum).toBe(0n);
  });

  it("한 명이면 결제자가 전액 부담한다", () => {
    expect(splitEqually({ amountMinor: "99", payerParticipantId: "solo", participantIds: ["solo"] }).shares)
      .toEqual([{ participantId: "solo", amountMinor: "99" }]);
  });

  it.each([
    [{ amountMinor: "10", payerParticipantId: "a", participantIds: [] }, "EMPTY_PARTICIPANTS"],
    [{ amountMinor: "10", payerParticipantId: "a", participantIds: ["a", "a"] }, "DUPLICATE_PARTICIPANT"],
    [{ amountMinor: "10", payerParticipantId: "x", participantIds: ["a", "b"] }, "PAYER_NOT_PARTICIPANT"],
  ] as const)("유효하지 않은 스냅샷을 거부한다", (input, code) => {
    expect(() => splitEqually(input)).toThrowError(expect.objectContaining<Partial<DomainError>>({ code }));
  });

  it("입력 순서와 무관하게 결정적이며 입력 배열을 바꾸지 않는다", () => {
    const participantIds = ["c", "a", "b"];
    const first = splitEqually({ amountMinor: "11", payerParticipantId: "c", participantIds });
    const second = splitEqually({ amountMinor: "11", payerParticipantId: "c", participantIds: ["b", "c", "a"] });
    expect(first).toEqual(second);
    expect(participantIds).toEqual(["c", "a", "b"]);
    expect(JSON.stringify(first)).not.toContain("bigint");
    expect(() => JSON.stringify(first)).not.toThrow();
  });
});
