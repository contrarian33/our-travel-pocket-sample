export type DomainErrorCode =
  | "INVALID_CURRENCY"
  | "INVALID_DISPLAY_AMOUNT"
  | "INVALID_MINOR_AMOUNT"
  | "EMPTY_PARTICIPANTS"
  | "DUPLICATE_PARTICIPANT"
  | "PAYER_NOT_PARTICIPANT"
  | "TOO_MANY_PARTICIPANTS"
  | "UNBALANCED_BALANCES";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
