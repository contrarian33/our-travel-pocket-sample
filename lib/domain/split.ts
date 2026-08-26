import { DomainError } from "./errors";
import { amountMinorToBigInt } from "./money";
import type { EqualSplit } from "./types";

export type EqualSplitInput = {
  amountMinor: string;
  payerParticipantId: string;
  participantIds: readonly string[];
};

export function splitEqually(input: EqualSplitInput): EqualSplit {
  const participantIds = [...input.participantIds].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  if (participantIds.length === 0) {
    throw new DomainError("EMPTY_PARTICIPANTS", "공동 경비에는 일행이 한 명 이상 필요합니다.");
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new DomainError("DUPLICATE_PARTICIPANT", "공동 경비 일행 ID는 중복될 수 없습니다.");
  }
  if (!participantIds.includes(input.payerParticipantId)) {
    throw new DomainError("PAYER_NOT_PARTICIPANT", "결제자는 공동 경비 일행에 포함되어야 합니다.");
  }

  const amount = amountMinorToBigInt(input.amountMinor);
  const participantCount = BigInt(participantIds.length);
  const baseShare = amount / participantCount;
  const payerRemainder = amount % participantCount;

  return {
    amountMinor: amount.toString(),
    payerParticipantId: input.payerParticipantId,
    participantIds,
    baseShareMinor: baseShare.toString(),
    payerRemainderMinor: payerRemainder.toString(),
    shares: participantIds.map((participantId) => ({
      participantId,
      amountMinor: (baseShare + (participantId === input.payerParticipantId ? payerRemainder : 0n)).toString(),
    })),
  };
}
