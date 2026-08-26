import { z } from "zod";

import { CURRENCIES } from "@/lib/domain/types";

export const STORAGE_KEY_V1 = "our-travel-pocket:v1";
export const MAX_AMOUNT_MINOR = 999_999_999_999n;
export const TEXT_LIMITS = { tripName: 100, country: 100, participantName: 50, expenseTitle: 120 } as const;

export function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function participantNameKey(value: string): string {
  return normalizeText(value).toLowerCase();
}

const idSchema = z.string().min(1);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "유효한 날짜를 입력해 주세요.");

function normalizedTextSchema(maximum: number, label: string) {
  return z.string().transform(normalizeText).pipe(z.string().min(1, `${label}을(를) 입력해 주세요.`).max(maximum, `${label}은(는) ${maximum}자 이하여야 합니다.`));
}

const amountMinorSchema = z.string().regex(/^[1-9]\d*$/, "금액은 양의 최소 단위 정수여야 합니다.").refine(
  (value) => BigInt(value) <= MAX_AMOUNT_MINOR,
  "금액이 저장 가능한 최대값을 초과했습니다.",
);

export const participantSchema = z.object({
  id: idSchema,
  displayName: normalizedTextSchema(TEXT_LIMITS.participantName, "일행 이름"),
}).strict();

export const expenseSchema = z.object({
  id: idSchema,
  title: normalizedTextSchema(TEXT_LIMITS.expenseTitle, "경비 항목명"),
  expenseDate: dateSchema,
  currency: z.enum(CURRENCIES),
  amountMinor: amountMinorSchema,
  payerParticipantId: idSchema,
  kind: z.enum(["shared", "personal"]),
  participantIds: z.array(idSchema),
  participantCountSnapshot: z.number().int(),
}).strict();

export const tripSchema = z.object({
  id: idSchema,
  name: normalizedTextSchema(TEXT_LIMITS.tripName, "여행 이름"),
  country: z.string().transform((value) => normalizeText(value)).pipe(z.string().max(TEXT_LIMITS.country, "국가는 100자 이하여야 합니다.")).nullable(),
  startDate: dateSchema,
  endDate: dateSchema,
  participants: z.array(participantSchema).max(10, "일행은 최대 10명까지 추가할 수 있습니다."),
  expenses: z.array(expenseSchema),
}).strict().superRefine((trip, context) => {
  if (trip.endDate < trip.startDate) context.addIssue({ code: "custom", path: ["endDate"], message: "종료일은 시작일보다 빠를 수 없습니다." });
  const entityIds = new Set<string>([trip.id]);
  const participantIds = new Set<string>();
  const nameKeys = new Set<string>();
  for (const [index, participant] of trip.participants.entries()) {
    if (entityIds.has(participant.id)) context.addIssue({ code: "custom", path: ["participants", index, "id"], message: "저장 데이터의 ID가 중복되었습니다." });
    entityIds.add(participant.id);
    participantIds.add(participant.id);
    const key = participantNameKey(participant.displayName);
    if (nameKeys.has(key)) context.addIssue({ code: "custom", path: ["participants", index, "displayName"], message: "같은 이름의 일행이 이미 있습니다." });
    nameKeys.add(key);
  }
  for (const [index, expense] of trip.expenses.entries()) {
    const path = ["expenses", index] as const;
    if (entityIds.has(expense.id)) context.addIssue({ code: "custom", path: [...path, "id"], message: "저장 데이터의 ID가 중복되었습니다." });
    entityIds.add(expense.id);
    if (!participantIds.has(expense.payerParticipantId)) context.addIssue({ code: "custom", path: [...path, "payerParticipantId"], message: "결제자가 현재 일행에 없습니다." });
    const snapshot = new Set(expense.participantIds);
    if (snapshot.size !== expense.participantIds.length) context.addIssue({ code: "custom", path: [...path, "participantIds"], message: "참여 일행 ID가 중복되었습니다." });
    if (expense.participantIds.some((id) => !participantIds.has(id))) context.addIssue({ code: "custom", path: [...path, "participantIds"], message: "참여 일행 참조가 올바르지 않습니다." });
    if (expense.kind === "personal" && expense.participantIds.length !== 0) context.addIssue({ code: "custom", path: [...path, "participantIds"], message: "개인 지출의 참여 일행은 비어 있어야 합니다." });
    if (expense.kind === "personal" && expense.participantCountSnapshot !== 0) context.addIssue({ code: "custom", path: [...path, "participantCountSnapshot"], message: "개인 지출의 참여 인원 스냅샷은 0이어야 합니다." });
    if (expense.kind === "shared" && (expense.participantCountSnapshot < 1 || expense.participantCountSnapshot > 10 || expense.participantCountSnapshot !== expense.participantIds.length)) context.addIssue({ code: "custom", path: [...path, "participantCountSnapshot"], message: "공동 경비의 참여 인원 스냅샷이 올바르지 않습니다." });
    if (expense.kind === "shared" && (expense.participantIds.length === 0 || !snapshot.has(expense.payerParticipantId))) context.addIssue({ code: "custom", path: [...path, "participantIds"], message: "공동 경비에는 결제자를 포함한 참여 일행이 필요합니다." });
  }
});

export const storedStateV1Schema = z.object({ schemaVersion: z.literal(1), trip: tripSchema }).strict();

export type StoredStateV1 = z.infer<typeof storedStateV1Schema>;
export type TripV1 = StoredStateV1["trip"];
export type ParticipantV1 = TripV1["participants"][number];
export type ExpenseV1 = TripV1["expenses"][number];
