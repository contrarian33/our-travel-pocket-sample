// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StoredStateV1 } from "@/lib/storage/schema";
import { SettlementView } from "./app-shell";

afterEach(cleanup);
const state:StoredStateV1={schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"a",displayName:"아라"},{id:"b",displayName:"보라"}],expenses:[{id:"shared",title:"숙소",expenseDate:"2026-08-28",currency:"KRW",amountMinor:"100",payerParticipantId:"a",kind:"shared",participantIds:["a","b"],participantCountSnapshot:2},{id:"personal",title:"개인 쇼핑",expenseDate:"2026-08-28",currency:"KRW",amountMinor:"999",payerParticipantId:"b",kind:"personal",participantIds:[],participantCountSnapshot:0}]}};

describe("정산 UI",()=>{
  it("공동 경비가 없으면 개인 지출 제외를 설명하는 빈 상태를 표시한다",()=>{render(<SettlementView state={{...state,trip:{...state.trip,expenses:state.trip.expenses.filter(expense=>expense.kind==="personal")}}}/>);expect(screen.getByText(/아직 공동 경비가 없습니다/)).toBeTruthy()});
  it("집계, 최소 송금과 0원 나머지를 포함한 분할 근거를 표시한다",()=>{render(<SettlementView state={state}/>);expect(screen.getAllByText("100 KRW")).toHaveLength(2);expect(screen.queryByText("999 KRW")).toBeNull();expect(screen.getByText("결제자 나머지").nextElementSibling?.textContent).toBe("0 KRW");expect(screen.getAllByText("보라").length).toBeGreaterThan(0)});
});
