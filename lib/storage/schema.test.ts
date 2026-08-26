import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_MINOR, normalizeText, participantNameKey, storedStateV1Schema } from "./schema";

const valid = () => ({schemaVersion:1 as const,trip:{id:"t",name:"도쿄",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"p1",displayName:"Una"},{id:"p2",displayName:"Kim"}],expenses:[{id:"e1",title:"숙소",expenseDate:"2026-08-20",currency:"KRW" as const,amountMinor:"10000",payerParticipantId:"p1",kind:"shared" as const,participantIds:["p1","p2"],participantCountSnapshot:2}]}});
describe("StoredStateV1",()=>{
  it("정상 v1 전체 데이터를 검증한다",()=>expect(storedStateV1Schema.safeParse(valid()).success).toBe(true));
  it.each([
    ["trip과 participant",(data:ReturnType<typeof valid>)=>{data.trip.participants[0].id=data.trip.id;data.trip.expenses[0].payerParticipantId=data.trip.id;data.trip.expenses[0].participantIds[0]=data.trip.id}],
    ["trip과 expense",(data:ReturnType<typeof valid>)=>{data.trip.expenses[0].id=data.trip.id}],
    ["participant와 expense",(data:ReturnType<typeof valid>)=>{data.trip.expenses[0].id=data.trip.participants[0].id}],
  ])("%s ID 충돌을 거부한다",(_label,collide)=>{const data=valid();collide(data);expect(storedStateV1Schema.safeParse(data).success).toBe(false)});
  it("trip, participant, expense ID가 모두 다르면 정상 통과한다",()=>{const data=valid();expect(new Set([data.trip.id,...data.trip.participants.map(({id})=>id),...data.trip.expenses.map(({id})=>id)]).size).toBe(4);expect(storedStateV1Schema.safeParse(data).success).toBe(true)});
  it.each([[2,"버전"],[1,"날짜"]])("잘못된 버전/날짜를 거부한다",(value,kind)=>{const data=valid();if(kind==="버전")Object.assign(data,{schemaVersion:value});else data.trip.endDate="2026-02-30";expect(storedStateV1Schema.safeParse(data).success).toBe(false)});
  it("역전 기간, 중복 ID와 정규화 이름, 10명 초과를 거부한다",()=>{const data=valid();data.trip.endDate="2026-08-01";data.trip.participants.push({id:"p2",displayName:" ＵＮＡ "});expect(storedStateV1Schema.safeParse(data).success).toBe(false)});
  it("텍스트 길이와 금액 상한을 검증한다",()=>{const data=valid();data.trip.name="가".repeat(101);data.trip.expenses[0].amountMinor=(MAX_AMOUNT_MINOR+1n).toString();expect(storedStateV1Schema.safeParse(data).success).toBe(false)});
  it("통화, payer 참조와 kind별 스냅샷 불변식을 거부한다",()=>{const cases=[valid(),valid(),valid()];cases[0].trip.expenses[0].payerParticipantId="missing";Object.assign(cases[1].trip.expenses[0],{kind:"personal",participantIds:["p1"],participantCountSnapshot:0});cases[2].trip.expenses[0].participantIds=["p2"];cases[2].trip.expenses[0].participantCountSnapshot=1;for(const data of cases)expect(storedStateV1Schema.safeParse(data).success).toBe(false)});
  it.each([
    ["participant 누락과 유지된 count",(data:ReturnType<typeof valid>)=>{data.trip.expenses[0].participantIds=["p1"]}],
    ["participantIds 중복",(data:ReturnType<typeof valid>)=>{data.trip.expenses[0].participantIds=["p1","p1"]}],
    ["count 불일치",(data:ReturnType<typeof valid>)=>{data.trip.expenses[0].participantCountSnapshot=1}],
    ["shared count 0",(data:ReturnType<typeof valid>)=>{data.trip.expenses[0].participantIds=[];data.trip.expenses[0].participantCountSnapshot=0}],
    ["shared count 10 초과",(data:ReturnType<typeof valid>)=>{data.trip.expenses[0].participantCountSnapshot=11}],
    ["personal participantIds",(data:ReturnType<typeof valid>)=>{Object.assign(data.trip.expenses[0],{kind:"personal",participantIds:["p1"],participantCountSnapshot:1})}],
    ["personal count",(data:ReturnType<typeof valid>)=>{Object.assign(data.trip.expenses[0],{kind:"personal",participantIds:[],participantCountSnapshot:1})}],
  ])("잘못된 %s 스냅샷을 거부한다",(_label,mutate)=>{const data=valid();mutate(data);expect(storedStateV1Schema.safeParse(data).success).toBe(false)});
  it("과거 스냅샷이 현재 일행의 정상 부분집합이면 통과한다",()=>{const data=valid();data.trip.participants.push({id:"p3",displayName:"Lee"});expect(storedStateV1Schema.safeParse(data).success).toBe(true)});
  it("NFKC와 공백을 정돈하고 비교 키를 소문자로 만든다",()=>{expect(normalizeText(" Ｕｎａ   Kim ")).toBe("Una Kim");expect(participantNameKey("Una   Kim")).toBe("una kim")});
});
