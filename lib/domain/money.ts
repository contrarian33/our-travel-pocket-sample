import { DomainError } from "./errors";
import type { Currency } from "./types";

const POSITIVE_MINOR_PATTERN = /^[0-9]+$/;
const WHOLE_DISPLAY_PATTERN = /^[0-9]+$/;
const USD_DISPLAY_PATTERN = /^[0-9]+(?:\.[0-9]{1,2})?$/;

function normalizePositiveInteger(value: string, errorCode: "INVALID_DISPLAY_AMOUNT" | "INVALID_MINOR_AMOUNT") {
  if (!POSITIVE_MINOR_PATTERN.test(value)) {
    throw new DomainError(errorCode, "금액은 부호 없는 10진수여야 합니다.");
  }

  const normalized = value.replace(/^0+/, "") || "0";
  if (normalized === "0") {
    throw new DomainError(errorCode, "금액은 0보다 커야 합니다.");
  }
  return normalized;
}

export function normalizeAmountMinor(value: string): string {
  return normalizePositiveInteger(value, "INVALID_MINOR_AMOUNT");
}

export function amountMinorToBigInt(value: string): bigint {
  return BigInt(normalizeAmountMinor(value));
}

export function parseDisplayAmount(currency: Currency, value: string): string {
  if (currency === "KRW" || currency === "JPY") {
    if (!WHOLE_DISPLAY_PATTERN.test(value)) {
      throw new DomainError("INVALID_DISPLAY_AMOUNT", `${currency} 금액은 양의 정수여야 합니다.`);
    }
    return normalizePositiveInteger(value, "INVALID_DISPLAY_AMOUNT");
  }

  if (currency !== "USD") {
    throw new DomainError("INVALID_CURRENCY", "지원하지 않는 통화입니다.");
  }
  if (!USD_DISPLAY_PATTERN.test(value)) {
    throw new DomainError("INVALID_DISPLAY_AMOUNT", "USD 금액은 소수점 둘째 자리까지 입력해야 합니다.");
  }

  const [whole, fraction = ""] = value.split(".");
  const cents = `${whole}${fraction.padEnd(2, "0")}`;
  return normalizePositiveInteger(cents, "INVALID_DISPLAY_AMOUNT");
}

export function formatAmountMinor(currency: Currency, value: string): string {
  if (!POSITIVE_MINOR_PATTERN.test(value)) {
    throw new DomainError("INVALID_MINOR_AMOUNT", "금액은 부호 없는 10진수여야 합니다.");
  }
  const normalized = value.replace(/^0+/, "") || "0";
  if (currency === "KRW" || currency === "JPY") return normalized;
  if (currency !== "USD") {
    throw new DomainError("INVALID_CURRENCY", "지원하지 않는 통화입니다.");
  }

  const padded = normalized.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}
