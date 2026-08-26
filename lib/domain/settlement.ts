import { DomainError } from "./errors";
import { amountMinorToBigInt } from "./money";
import { splitEqually } from "./split";
import { CURRENCIES, type Currency, type CurrencyBalance, type SharedExpense, type Transfer } from "./types";

const MAX_PARTICIPANTS = 10;

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function calculateBalances(expenses: readonly SharedExpense[]): CurrencyBalance[] {
  const balances = new Map<string, bigint>();
  const participantIds = new Set(expenses.flatMap((expense) => expense.participantIds));
  if (participantIds.size > MAX_PARTICIPANTS) {
    throw new DomainError("TOO_MANY_PARTICIPANTS", "정산은 여행 전체 최대 10명까지 지원합니다.");
  }

  for (const expense of [...expenses].sort((a, b) => compareText(a.id, b.id))) {
    const split = splitEqually(expense);
    const amount = amountMinorToBigInt(split.amountMinor);
    for (const share of split.shares) {
      const key = `${expense.currency}\u0000${share.participantId}`;
      const paid = share.participantId === expense.payerParticipantId ? amount : 0n;
      balances.set(key, (balances.get(key) ?? 0n) + paid - BigInt(share.amountMinor));
    }
  }

  return [...balances.entries()]
    .map(([key, amount]) => {
      const [currency, participantId] = key.split("\u0000") as [Currency, string];
      return { currency, participantId, amountMinor: amount.toString() };
    })
    .sort((a, b) => compareText(a.currency, b.currency) || compareText(a.participantId, b.participantId));
}

type InternalBalance = { participantId: string; amount: bigint };

function maximumZeroSumPartition(items: readonly InternalBalance[]): number[][] {
  const fullMask = (1 << items.length) - 1;
  const sums = Array<bigint>(fullMask + 1).fill(0n);
  for (let mask = 1; mask <= fullMask; mask += 1) {
    const bit = mask & -mask;
    const index = Math.log2(bit);
    sums[mask] = sums[mask ^ bit] + items[index].amount;
  }

  const memo = new Map<number, number[][]>();
  const solve = (mask: number): number[][] => {
    if (mask === 0) return [];
    const cached = memo.get(mask);
    if (cached) return cached;
    const anchor = mask & -mask;
    let best: number[][] = [];
    for (let group = mask; group > 0; group = (group - 1) & mask) {
      if ((group & anchor) === 0 || sums[group] !== 0n) continue;
      const candidate = [maskToIndices(group, items.length), ...solve(mask ^ group)];
      if (candidate.length > best.length || (candidate.length === best.length && partitionKey(candidate, items) < partitionKey(best, items))) {
        best = candidate;
      }
    }
    memo.set(mask, best);
    return best;
  };
  return solve(fullMask);
}

function maskToIndices(mask: number, length: number): number[] {
  return Array.from({ length }, (_, index) => index).filter((index) => (mask & (1 << index)) !== 0);
}

function partitionKey(groups: readonly number[][], items: readonly InternalBalance[]) {
  return groups.map((group) => group.map((index) => items[index].participantId).join(",")).sort().join("|");
}

function settleGroup(currency: Currency, group: readonly InternalBalance[]): Transfer[] {
  const senders = group.filter((item) => item.amount < 0n).map((item) => ({ ...item, remaining: -item.amount }));
  const receivers = group.filter((item) => item.amount > 0n).map((item) => ({ ...item, remaining: item.amount }));
  const transfers: Transfer[] = [];
  let senderIndex = 0;
  let receiverIndex = 0;

  while (senderIndex < senders.length && receiverIndex < receivers.length) {
    const sender = senders[senderIndex];
    const receiver = receivers[receiverIndex];
    const amount = sender.remaining < receiver.remaining ? sender.remaining : receiver.remaining;
    transfers.push({ currency, senderParticipantId: sender.participantId, receiverParticipantId: receiver.participantId, amountMinor: amount.toString() });
    sender.remaining -= amount;
    receiver.remaining -= amount;
    if (sender.remaining === 0n) senderIndex += 1;
    if (receiver.remaining === 0n) receiverIndex += 1;
  }
  return transfers;
}

export function calculateMinimumTransfers(balances: readonly CurrencyBalance[]): Transfer[] {
  if (new Set(balances.map((balance) => balance.participantId)).size > MAX_PARTICIPANTS) {
    throw new DomainError("TOO_MANY_PARTICIPANTS", "정산은 여행 전체 최대 10명까지 지원합니다.");
  }
  const transfers: Transfer[] = [];
  for (const currency of CURRENCIES) {
    const merged = new Map<string, bigint>();
    for (const balance of balances.filter((item) => item.currency === currency)) {
      if (!/^-?[0-9]+$/.test(balance.amountMinor)) {
        throw new DomainError("INVALID_MINOR_AMOUNT", "잔액은 10진 정수 문자열이어야 합니다.");
      }
      merged.set(balance.participantId, (merged.get(balance.participantId) ?? 0n) + BigInt(balance.amountMinor));
    }
    const items = [...merged.entries()]
      .filter(([, amount]) => amount !== 0n)
      .map(([participantId, amount]) => ({ participantId, amount }))
      .sort((a, b) => compareText(a.participantId, b.participantId));
    if (items.length > MAX_PARTICIPANTS) {
      throw new DomainError("TOO_MANY_PARTICIPANTS", "정산은 통화별 최대 10명까지 지원합니다.");
    }
    if (items.reduce((sum, item) => sum + item.amount, 0n) !== 0n) {
      throw new DomainError("UNBALANCED_BALANCES", "통화별 잔액 합계는 0이어야 합니다.");
    }
    for (const indices of maximumZeroSumPartition(items)) {
      transfers.push(...settleGroup(currency, indices.map((index) => items[index])));
    }
  }
  return transfers.sort((a, b) => compareText(a.currency, b.currency) || compareText(a.senderParticipantId, b.senderParticipantId) || compareText(a.receiverParticipantId, b.receiverParticipantId) || compareText(a.amountMinor, b.amountMinor));
}

export function settleExpenses(expenses: readonly SharedExpense[]): Transfer[] {
  return calculateMinimumTransfers(calculateBalances(expenses));
}
