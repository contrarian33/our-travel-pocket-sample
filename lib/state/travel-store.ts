import { parseDisplayAmount } from "@/lib/domain/money";
import type { Currency } from "@/lib/domain/types";
import { saveState, type StorageAdapter } from "@/lib/storage/repository";
import { normalizeText, participantNameKey, storedStateV1Schema, type ExpenseV1, type StoredStateV1, type TripV1 } from "@/lib/storage/schema";

export type IdFactory = () => string;
export type MutationResult = { ok: true; state: StoredStateV1 } | { ok: false; message: string };
export type TripInput = Pick<TripV1, "name" | "country" | "startDate" | "endDate">;
export type ExpenseInput = Pick<ExpenseV1, "title" | "expenseDate" | "currency" | "payerParticipantId" | "kind"> & { amount: string };

function persisted(storage: StorageAdapter, candidate: StoredStateV1): MutationResult {
  const parsed = storedStateV1Schema.safeParse(candidate);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const result = saveState(storage, parsed.data);
  return result.ok ? { ok: true, state: parsed.data } : { ok: false, message: result.message };
}

export function createTrip(storage: StorageAdapter, idFactory: IdFactory, input: TripInput): MutationResult {
  return persisted(storage, { schemaVersion: 1, trip: { id: idFactory(), ...input, country: input.country ? normalizeText(input.country) || null : null, participants: [], expenses: [] } });
}

export function updateTrip(storage: StorageAdapter, state: StoredStateV1, input: TripInput): MutationResult {
  return persisted(storage, { ...state, trip: { ...state.trip, ...input, country: input.country ? normalizeText(input.country) || null : null } });
}

export function addParticipant(storage: StorageAdapter, state: StoredStateV1, idFactory: IdFactory, displayName: string): MutationResult {
  const normalized = normalizeText(displayName);
  if (state.trip.participants.some((item) => participantNameKey(item.displayName) === participantNameKey(normalized))) return { ok: false, message: "같은 이름의 일행이 이미 있습니다." };
  return persisted(storage, { ...state, trip: { ...state.trip, participants: [...state.trip.participants, { id: idFactory(), displayName: normalized }] } });
}

export function updateParticipant(storage: StorageAdapter, state: StoredStateV1, participantId: string, displayName: string): MutationResult {
  if (!state.trip.participants.some((item) => item.id === participantId)) return { ok: false, message: "수정할 일행을 찾을 수 없습니다." };
  const normalized = normalizeText(displayName);
  if (state.trip.participants.some((item) => item.id !== participantId && participantNameKey(item.displayName) === participantNameKey(normalized))) return { ok: false, message: "같은 이름의 일행이 이미 있습니다." };
  return persisted(storage, { ...state, trip: { ...state.trip, participants: state.trip.participants.map((item) => item.id === participantId ? { ...item, displayName: normalized } : item) } });
}

export function deleteParticipant(storage: StorageAdapter, state: StoredStateV1, participantId: string): MutationResult {
  if (!state.trip.participants.some((item) => item.id === participantId)) return { ok: false, message: "삭제할 일행을 찾을 수 없습니다." };
  if (state.trip.expenses.some((expense) => expense.payerParticipantId === participantId || expense.participantIds.includes(participantId))) return { ok: false, message: "이 일행을 참조하는 경비가 있어 삭제할 수 없습니다. 관련 경비를 먼저 삭제해 주세요." };
  return persisted(storage, { ...state, trip: { ...state.trip, participants: state.trip.participants.filter((item) => item.id !== participantId) } });
}

function expenseCandidate(state: StoredStateV1, input: ExpenseInput, existing?: ExpenseV1): ExpenseV1 | { error: string } {
  let amountMinor: string;
  try { amountMinor = parseDisplayAmount(input.currency as Currency, input.amount); }
  catch (error) { return { error: error instanceof Error ? error.message : "금액을 확인해 주세요." }; }
  const allIds = state.trip.participants.map((item) => item.id);
  const participantIds = input.kind === "personal" ? [] : existing?.kind === "shared" ? [...existing.participantIds] : allIds;
  const participantCountSnapshot = input.kind === "personal" ? 0 : existing?.kind === "shared" ? existing.participantCountSnapshot : participantIds.length;
  if (input.kind === "shared" && !participantIds.includes(input.payerParticipantId)) return { error: "공동 경비의 결제자는 저장된 참여 일행 안에서 선택해 주세요." };
  return { id: existing?.id ?? "", title: normalizeText(input.title), expenseDate: input.expenseDate, currency: input.currency, amountMinor, payerParticipantId: input.payerParticipantId, kind: input.kind, participantIds, participantCountSnapshot };
}

export function addExpense(storage: StorageAdapter, state: StoredStateV1, idFactory: IdFactory, input: ExpenseInput): MutationResult {
  if (state.trip.participants.length === 0) return { ok: false, message: "일행을 먼저 추가해 주세요." };
  const expense = expenseCandidate(state, input);
  if ("error" in expense) return { ok: false, message: expense.error };
  return persisted(storage, { ...state, trip: { ...state.trip, expenses: [...state.trip.expenses, { ...expense, id: idFactory() }] } });
}

export function updateExpense(storage: StorageAdapter, state: StoredStateV1, expenseId: string, input: ExpenseInput): MutationResult {
  const existing = state.trip.expenses.find((item) => item.id === expenseId);
  if (!existing) return { ok: false, message: "수정할 경비를 찾을 수 없습니다." };
  const expense = expenseCandidate(state, input, existing);
  if ("error" in expense) return { ok: false, message: expense.error };
  return persisted(storage, { ...state, trip: { ...state.trip, expenses: state.trip.expenses.map((item) => item.id === expenseId ? expense : item) } });
}

export function deleteExpense(storage: StorageAdapter, state: StoredStateV1, expenseId: string): MutationResult {
  if (!state.trip.expenses.some((item) => item.id === expenseId)) return { ok: false, message: "삭제할 경비를 찾을 수 없습니다." };
  return persisted(storage, { ...state, trip: { ...state.trip, expenses: state.trip.expenses.filter((item) => item.id !== expenseId) } });
}

export type ExpenseFilter = { type: "all" } | { type: "preparation" } | { type: "date"; date: string };
export function filterExpenses(trip: TripV1, filter: ExpenseFilter): ExpenseV1[] {
  if (filter.type === "all") return [...trip.expenses];
  if (filter.type === "preparation") return trip.expenses.filter((item) => item.expenseDate < trip.startDate);
  return trip.expenses.filter((item) => item.expenseDate === filter.date);
}
