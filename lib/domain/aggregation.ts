import { amountMinorToBigInt } from "./money";
import { splitEqually } from "./split";
import { CURRENCIES, type Currency, type EqualSplit, type SharedExpense } from "./types";

export type SharedExpenseDetail = EqualSplit & { id: string; title: string; currency: Currency };
export type PayerCurrencyTotal = { participantId: string; currency: Currency; amountMinor: string; expenseIds: string[] };
type AggregationExpense = SharedExpense & { title: string; kind: "shared" | "personal" };

export function aggregateSharedExpenses(expenses: readonly AggregationExpense[]): PayerCurrencyTotal[] {
  const totals = new Map<string, { amount: bigint; expenseIds: string[] }>();
  for (const expense of expenses.filter((item) => item.kind === "shared").sort((a, b) => a.id.localeCompare(b.id))) {
    const key = `${expense.payerParticipantId}\u0000${expense.currency}`;
    const current = totals.get(key) ?? { amount: 0n, expenseIds: [] };
    current.amount += amountMinorToBigInt(expense.amountMinor);
    current.expenseIds.push(expense.id);
    totals.set(key, current);
  }
  return [...totals.entries()].map(([key, value]) => {
    const [participantId, currency] = key.split("\u0000") as [string, Currency];
    return { participantId, currency, amountMinor: value.amount.toString(), expenseIds: value.expenseIds };
  }).sort((a, b) => a.participantId.localeCompare(b.participantId) || CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency));
}

export function buildSharedExpenseDetails(expenses: readonly AggregationExpense[]): SharedExpenseDetail[] {
  return expenses.filter((expense) => expense.kind === "shared").map((expense) => ({
    id: expense.id, title: expense.title, currency: expense.currency, ...splitEqually(expense),
  })).sort((a, b) => a.id.localeCompare(b.id));
}
