import { describe, expect, it } from "vitest";

import { DomainError } from "./errors";
import { formatAmountMinor, normalizeAmountMinor, parseDisplayAmount } from "./money";

describe("money", () => {
  it.each([
    ["KRW", "123", "123"],
    ["JPY", "987", "987"],
    ["USD", "12", "1200"],
    ["USD", "12.3", "1230"],
    ["USD", "12.34", "1234"],
    ["KRW", "00042", "42"],
    ["USD", "00012.30", "1230"],
  ] as const)("%s 화면 입력 %s를 최소 단위 %s로 변환한다", (currency, input, expected) => {
    expect(parseDisplayAmount(currency, input)).toBe(expected);
  });

  it.each(["", "0", "000", "-1", "+1", " 1", "1 ", "1,000", "1e3", "abc", ".5", "1.234", "1."])(
    "잘못된 USD 입력 %j를 구분 가능한 오류로 거부한다",
    (input) => {
      expect(() => parseDisplayAmount("USD", input)).toThrowError(
        expect.objectContaining<Partial<DomainError>>({ code: "INVALID_DISPLAY_AMOUNT" }),
      );
    },
  );

  it.each(["1.0", "-1", "+1", " 1", "1 ", "1,000", "1e3", ""])(
    "KRW/JPY의 정수가 아닌 입력 %j를 거부한다",
    (input) => {
      expect(() => parseDisplayAmount("KRW", input)).toThrow(DomainError);
      expect(() => parseDisplayAmount("JPY", input)).toThrow(DomainError);
    },
  );

  it("매우 큰 금액을 정밀도 손실 없이 왕복한다", () => {
    const display = "123456789012345678901234567890.12";
    const minor = parseDisplayAmount("USD", display);
    expect(minor).toBe("12345678901234567890123456789012");
    expect(formatAmountMinor("USD", minor)).toBe(display);
  });

  it.each([
    ["KRW", "0007", "7"],
    ["JPY", "900719925474099300000", "900719925474099300000"],
    ["USD", "1", "0.01"],
    ["USD", "10", "0.10"],
    ["USD", "1200", "12.00"],
    ["KRW", "0", "0"],
    ["USD", "0", "0.00"],
  ] as const)("%s 최소 단위 %s를 %s로 표시한다", (currency, minor, display) => {
    expect(formatAmountMinor(currency, minor)).toBe(display);
  });

  it("최소 단위 저장값은 양의 정수로 정규화한다", () => {
    expect(normalizeAmountMinor("000123")).toBe("123");
    expect(() => normalizeAmountMinor("0")).toThrowError(
      expect.objectContaining<Partial<DomainError>>({ code: "INVALID_MINOR_AMOUNT" }),
    );
  });

  it("공개 금액 결과는 bigint 없이 JSON 직렬화된다", () => {
    const dto = { currency: "USD", amountMinor: parseDisplayAmount("USD", "12.34") };
    expect(JSON.parse(JSON.stringify(dto))).toEqual({ currency: "USD", amountMinor: "1234" });
  });
});
