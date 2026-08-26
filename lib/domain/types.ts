export const CURRENCIES = ["KRW", "JPY", "USD"] as const;

export type Currency = (typeof CURRENCIES)[number];

export type SharedExpense = {
  id: string;
  currency: Currency;
  amountMinor: string;
  payerParticipantId: string;
  participantIds: readonly string[];
};

export type ParticipantShare = {
  participantId: string;
  amountMinor: string;
};

export type EqualSplit = {
  amountMinor: string;
  payerParticipantId: string;
  participantIds: string[];
  baseShareMinor: string;
  payerRemainderMinor: string;
  shares: ParticipantShare[];
};

export type CurrencyBalance = {
  currency: Currency;
  participantId: string;
  amountMinor: string;
};

export type Transfer = {
  currency: Currency;
  senderParticipantId: string;
  receiverParticipantId: string;
  amountMinor: string;
};
