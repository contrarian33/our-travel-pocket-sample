// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell, expenseDeletionMessage, formatLocalDate, NAVIGATION_ITEMS, SHELL_COPY } from "./app-shell";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AppShell", () => {
  it("중립 로딩 안내를 서버 렌더 결과에 표시한다", () => {
    const markup = renderToStaticMarkup(<AppShell />);

    expect(markup).toContain(SHELL_COPY.title);
    expect(markup).toContain(SHELL_COPY.eyebrow);
    expect(markup).toContain(SHELL_COPY.status);
    expect(markup).toContain(SHELL_COPY.storageNotice);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('<nav aria-label="모바일 주요 메뉴"');

    for (const item of NAVIGATION_ITEMS) {
      expect(markup).toContain(`>${item}</button>`);
    }

    expect(markup.match(/<button[^>]*disabled=""[^>]*aria-disabled="true"/g)).toHaveLength(
      NAVIGATION_ITEMS.length,
    );
  });

  it("마운트 후 빈 저장소에서 초기 설정과 유실 경고를 표시한다", async () => {
    render(<AppShell storage={new MemoryStorage()} idFactory={() => "trip"} />);
    expect(await screen.findByRole("heading", { name: "여행을 시작해 볼까요?" })).toBeTruthy();
    expect(screen.getByText(/백업과 복구 기능이 없습니다/)).toBeTruthy();
  });

  it("손상 데이터는 원본 대신 오류와 초기화만 표시한다", async () => {
    const storage = new MemoryStorage(); storage.setItem("our-travel-pocket:v1", "{");
    render(<AppShell storage={storage} />);
    expect(await screen.findByRole("heading", { name: "저장 데이터를 사용할 수 없습니다" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "전체 데이터 초기화" })).toBeTruthy();
  });

  it("localStorage 속성 접근 자체가 실패해도 오류 UI만 표시하고 자동 저장하지 않는다", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    let getterCalls = 0;
    Object.defineProperty(window, "localStorage", { configurable: true, get() { getterCalls += 1; throw new DOMException("blocked", "SecurityError"); } });
    try {
      render(<AppShell />);
      expect(await screen.findByRole("heading", { name: "저장 데이터를 사용할 수 없습니다" })).toBeTruthy();
      expect(screen.getByRole("alert").textContent).toContain("저장소에 접근할 수 없습니다");
      expect(screen.queryByRole("heading", { name: "여행을 시작해 볼까요?" })).toBeNull();
      expect(getterCalls).toBe(1);
      vi.stubGlobal("confirm", vi.fn(() => true));
      fireEvent.click(screen.getByRole("button", { name: "전체 데이터 초기화" }));
      expect(screen.getByRole("alert").textContent).toContain("초기화하지 못했습니다");
      expect(screen.queryByRole("heading", { name: "여행을 시작해 볼까요?" })).toBeNull();
      expect(getterCalls).toBe(2);
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }
  });

  it("여행·경비 내비게이션과 각 빈 상태를 전환한다", async () => {
    const storage = new MemoryStorage();
    storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[],expenses:[]}}));
    render(<AppShell storage={storage} />);
    await screen.findByRole("heading", { name: "여행 정보" });
    fireEvent.click(screen.getByRole("button", { name: "경비" }));
    expect(screen.getByText("일행이 없어 경비를 등록할 수 없습니다.")).toBeTruthy();
    expect(screen.getByText(/아직 경비가 없습니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "정산" }));
    expect(screen.getByText(/아직 공동 경비가 없습니다/)).toBeTruthy();
  });

  it("저장 실패 시 초기 설정 입력값과 오류를 유지한다", async () => {
    const storage = new MemoryStorage(); storage.setItem = () => { throw new Error("quota"); };
    render(<AppShell storage={storage} idFactory={() => "t"} />);
    const name = await screen.findByLabelText("여행 이름");
    fireEvent.change(name, { target: { value: "도쿄 여행" } });
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-08-28" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-08-30" } });
    fireEvent.click(screen.getByRole("button", { name: "여행 시작" }));
    expect((await screen.findByRole("alert")).textContent).toContain("저장하지 못했습니다");
    expect((name as HTMLInputElement).value).toBe("도쿄 여행");
  });

  it("초기화는 확인 전 실행하지 않는다", async () => {
    const storage = new MemoryStorage();
    storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[],expenses:[]}}));
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<AppShell storage={storage} />); await screen.findByRole("heading", { name: "여행 정보" });
    fireEvent.click(screen.getByRole("button", { name: "전체 데이터 초기화" }));
    await waitFor(() => expect(storage.getItem("our-travel-pocket:v1")).not.toBeNull());
  });

  it("기존 경비 수정 시 저장된 날짜를 오늘 날짜로 덮어쓰지 않는다", async () => {
    const storage = new MemoryStorage();
    storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"p",displayName:"Una"}],expenses:[{id:"e",title:"숙소",expenseDate:"2026-08-20",currency:"KRW",amountMinor:"100",payerParticipantId:"p",kind:"shared",participantIds:["p"],participantCountSnapshot:1}]}}));
    render(<AppShell storage={storage} />);
    await screen.findByRole("heading", { name: "여행 정보" });
    fireEvent.click(screen.getByRole("button", { name: "경비" }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect((screen.getByLabelText("날짜") as HTMLInputElement).value).toBe("2026-08-20");
  });

  it("정규화 대상 텍스트 입력에 raw maxLength를 적용하지 않는다", async () => {
    const storage = new MemoryStorage();
    const ids = ["trip", "participant"];
    render(<AppShell storage={storage} idFactory={() => ids.shift() ?? "expense"} />);
    const tripName = await screen.findByLabelText("여행 이름");
    const country = screen.getByLabelText("국가 (선택)");
    expect(tripName.getAttribute("maxlength")).toBeNull();
    expect(country.getAttribute("maxlength")).toBeNull();
    fireEvent.change(tripName, { target: { value: `여행${" ".repeat(110)}이름` } });
    fireEvent.change(country, { target: { value: " ＫＲ " } });
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-08-28" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-08-30" } });
    fireEvent.click(screen.getByRole("button", { name: "여행 시작" }));
    expect(await screen.findByRole("heading", { name: "여행 이름" })).toBeTruthy();
    expect(screen.getByText("KR")).toBeTruthy();
    const participantName = screen.getByLabelText("일행 표시 이름");
    expect(participantName.getAttribute("maxlength")).toBeNull();
    fireEvent.change(participantName, { target: { value: `Ｕｎａ${" ".repeat(60)}Ｋｉｍ` } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByText("Una Kim")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "경비" }));
    fireEvent.click(screen.getByRole("button", { name: "경비 등록" }));
    expect(screen.getByLabelText("항목명").getAttribute("maxlength")).toBeNull();
  });

  it("공동·개인 경비 삭제 확인은 대상과 영향 및 복구 불가를 구분한다", () => {
    const shared = expenseDeletionMessage({ title: "숙소", kind: "shared" });
    const personal = expenseDeletionMessage({ title: "기념품", kind: "personal" });
    expect(shared).toContain("숙소"); expect(shared).toContain("경비 목록"); expect(shared).toContain("집계"); expect(shared).toContain("정산"); expect(shared).toContain("복구");
    expect(personal).toContain("기념품"); expect(personal).toContain("경비 목록"); expect(personal).toContain("개인 지출 기록"); expect(personal).toContain("복구");
  });

  it("경비 삭제는 취소하면 유지하고 확인한 경우에만 저장한다", async () => {
    const storage = new MemoryStorage();
    storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"p",displayName:"Una"}],expenses:[{id:"e",title:"숙소",expenseDate:"2026-08-20",currency:"KRW",amountMinor:"100",payerParticipantId:"p",kind:"shared",participantIds:["p"],participantCountSnapshot:1}]}}));
    const confirm = vi.fn(() => false); vi.stubGlobal("confirm", confirm);
    render(<AppShell storage={storage} />); await screen.findByRole("heading", { name: "여행 정보" }); fireEvent.click(screen.getByRole("button", { name: "경비" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(JSON.parse(storage.getItem("our-travel-pocket:v1")!).trip.expenses).toHaveLength(1);
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(JSON.parse(storage.getItem("our-travel-pocket:v1")!).trip.expenses).toHaveLength(0));
  });

  it("편집 중인 일행 삭제 성공 후 추가 모드가 되고 취소 시에는 편집을 유지한다", async () => {
    const storage = new MemoryStorage();
    storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"p",displayName:"Una"}],expenses:[]}}));
    const confirm = vi.fn(() => false); vi.stubGlobal("confirm", confirm);
    render(<AppShell storage={storage} idFactory={() => "new-p"} />); await screen.findByText("Una"); fireEvent.click(screen.getByRole("button", { name: "이름 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect((screen.getByLabelText("일행 표시 이름") as HTMLInputElement).value).toBe("Una");
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect((screen.getByLabelText("일행 표시 이름") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "추가" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("일행 표시 이름"), { target: { value: "새 일행" } }); fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByText("새 일행")).toBeTruthy();
  });

  it("일행 삭제 실패 시 편집 상태와 기존 데이터를 유지한다", async () => {
    const storage = new MemoryStorage(); storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"p",displayName:"Una"}],expenses:[{id:"e",title:"숙소",expenseDate:"2026-08-20",currency:"KRW",amountMinor:"1",payerParticipantId:"p",kind:"shared",participantIds:["p"],participantCountSnapshot:1}]}}));
    vi.stubGlobal("confirm", vi.fn(() => true)); render(<AppShell storage={storage} />); await screen.findByText("Una"); fireEvent.click(screen.getByRole("button", { name: "이름 수정" })); fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect((screen.getByLabelText("일행 표시 이름") as HTMLInputElement).value).toBe("Una"); expect(screen.getAllByRole("alert").some((alert)=>alert.textContent?.includes("삭제할 수 없습니다"))).toBe(true);
  });

  it("편집 중인 경비 삭제는 성공 후 editor를 닫고 취소·저장 실패 시 유지한다", async () => {
    const storage = new MemoryStorage(); storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"p",displayName:"Una"}],expenses:[{id:"e",title:"숙소",expenseDate:"2026-08-20",currency:"KRW",amountMinor:"1",payerParticipantId:"p",kind:"personal",participantIds:[],participantCountSnapshot:0}]}}));
    const confirm = vi.fn(() => false); vi.stubGlobal("confirm", confirm); render(<AppShell storage={storage} />); await screen.findByRole("heading", { name: "여행 정보" }); fireEvent.click(screen.getByRole("button", { name: "경비" })); fireEvent.click(screen.getByRole("button", { name: "수정" })); fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByRole("heading", { name: "경비 수정" })).toBeTruthy();
    confirm.mockReturnValue(true); const originalSetItem=storage.setItem.bind(storage); storage.setItem=()=>{throw new Error("quota")}; fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByRole("heading", { name: "경비 수정" })).toBeTruthy(); expect(screen.getByRole("alert").textContent).toContain("저장하지 못했습니다");
    storage.setItem=originalSetItem; fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.queryByRole("heading", { name: "경비 수정" })).toBeNull();
  });

  it("전체 초기화 성공은 이전 여행의 탭·필터·편집 상태를 지우고 실패 시 보존한다", async () => {
    const storage = new MemoryStorage(); storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"old-t",name:"이전 여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"old-p",displayName:"Una"}],expenses:[{id:"old-e",title:"숙소",expenseDate:"2026-08-20",currency:"KRW",amountMinor:"1",payerParticipantId:"old-p",kind:"personal",participantIds:[],participantCountSnapshot:0}]}}));
    const ids=["new-t","new-p"]; vi.stubGlobal("confirm", vi.fn(() => true)); render(<AppShell storage={storage} idFactory={()=>ids.shift()??"new-e"} />); await screen.findByRole("heading", { name: "여행 정보" }); fireEvent.click(screen.getByRole("button", { name: "이름 수정" })); fireEvent.click(screen.getByRole("button", { name: "경비" })); fireEvent.click(screen.getByRole("button", { name: "수정" })); fireEvent.click(screen.getByRole("button", { name: "준비 기간" })); fireEvent.click(screen.getByRole("button", { name: "여행" }));
    const originalRemove=storage.removeItem.bind(storage); storage.removeItem=()=>{throw new Error("blocked")}; fireEvent.click(screen.getByRole("button", { name: "전체 데이터 초기화" })); expect((screen.getByLabelText("일행 표시 이름") as HTMLInputElement).value).toBe("Una");
    storage.removeItem=originalRemove; fireEvent.click(screen.getByRole("button", { name: "전체 데이터 초기화" })); await screen.findByRole("heading", { name: "여행을 시작해 볼까요?" });
    fireEvent.change(screen.getByLabelText("여행 이름"),{target:{value:"새 여행"}}); fireEvent.change(screen.getByLabelText("시작일"),{target:{value:"2026-09-01"}}); fireEvent.change(screen.getByLabelText("종료일"),{target:{value:"2026-09-02"}}); fireEvent.click(screen.getByRole("button",{name:"여행 시작"}));
    expect((await screen.findByLabelText("일행 표시 이름") as HTMLInputElement).value).toBe(""); expect(screen.getByRole("button",{name:"추가"})).toBeTruthy(); fireEvent.click(screen.getByRole("button",{name:"경비"})); expect(screen.queryByRole("heading",{name:"경비 수정"})).toBeNull(); expect(screen.getByRole("button",{name:"전체"}).getAttribute("aria-pressed")).toBe("true"); expect((screen.getByLabelText("특정 날짜") as HTMLInputElement).value).toBe("");
  });

  it("날짜 필터를 지우거나 다른 필터를 선택하면 날짜 입력과 목록을 함께 갱신한다", async () => {
    const storage = new MemoryStorage();
    storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"p",displayName:"Una"}],expenses:[
      {id:"before",title:"준비 경비",expenseDate:"2026-08-20",currency:"KRW",amountMinor:"100",payerParticipantId:"p",kind:"personal",participantIds:[],participantCountSnapshot:0},
      {id:"during",title:"여행 경비",expenseDate:"2026-08-29",currency:"KRW",amountMinor:"200",payerParticipantId:"p",kind:"personal",participantIds:[],participantCountSnapshot:0},
    ]}}));
    render(<AppShell storage={storage} />);
    await screen.findByRole("heading", { name: "여행 정보" });
    fireEvent.click(screen.getByRole("button", { name: "경비" }));
    const date = screen.getByLabelText("특정 날짜") as HTMLInputElement;

    fireEvent.change(date, { target: { value: "2026-08-29" } });
    expect(date.value).toBe("2026-08-29");
    expect(screen.queryByText("준비 경비")).toBeNull();
    expect(screen.getByText("여행 경비")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(date.value).toBe("");
    expect(screen.getByText("준비 경비")).toBeTruthy();
    expect(screen.getByText("여행 경비")).toBeTruthy();

    fireEvent.change(date, { target: { value: "2026-08-29" } });
    fireEvent.click(screen.getByRole("button", { name: "준비 기간" }));
    expect(date.value).toBe("");
    expect(screen.getByText("준비 경비")).toBeTruthy();
    expect(screen.queryByText("여행 경비")).toBeNull();

    fireEvent.change(date, { target: { value: "2026-08-29" } });
    fireEvent.change(date, { target: { value: "" } });
    expect(date.value).toBe("");
    expect(screen.getByRole("button", { name: "전체" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("준비 경비")).toBeTruthy();
    expect(screen.getByText("여행 경비")).toBeTruthy();
  });

  it("경비 편집 컨텍스트가 바뀌면 입력·오류를 대상 값 또는 신규 기본값으로 초기화한다", async () => {
    const storage = new MemoryStorage();
    const originalA = {id:"a",title:"A 숙소",expenseDate:"2026-08-20",currency:"USD",amountMinor:"1234",payerParticipantId:"p1",kind:"shared",participantIds:["p1"],participantCountSnapshot:1};
    const originalB = {id:"b",title:"B 식사",expenseDate:"2026-08-29",currency:"JPY",amountMinor:"5000",payerParticipantId:"p2",kind:"shared",participantIds:["p1","p2"],participantCountSnapshot:2};
    storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"p1",displayName:"Una"},{id:"p2",displayName:"Bo"},{id:"p3",displayName:"Cy"}],expenses:[originalA,originalB]}}));
    render(<AppShell storage={storage} idFactory={() => "new-expense"} />);
    await screen.findByRole("heading", { name: "여행 정보" });
    fireEvent.click(screen.getByRole("button", { name: "경비" }));

    fireEvent.click(screen.getAllByRole("button", { name: "수정" })[0]);
    fireEvent.change(screen.getByLabelText("항목명"), { target: { value: "저장하지 않은 A" } });
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "99.99" } });
    fireEvent.click(screen.getAllByRole("button", { name: "수정" })[1]);
    expect((screen.getByLabelText("항목명") as HTMLInputElement).value).toBe("B 식사");
    expect((screen.getByLabelText("날짜") as HTMLInputElement).value).toBe("2026-08-29");
    expect((screen.getByLabelText("금액") as HTMLInputElement).value).toBe("5000");
    expect((screen.getByLabelText("통화") as HTMLSelectElement).value).toBe("JPY");
    expect((screen.getByLabelText("결제자") as HTMLSelectElement).value).toBe("p2");
    expect([...screen.getByLabelText("결제자").querySelectorAll("option")].map(option => option.value)).toEqual(["p1", "p2"]);

    fireEvent.change(screen.getByLabelText("항목명"), { target: { value: "수정된 B" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    let expenses = JSON.parse(storage.getItem("our-travel-pocket:v1")!).trip.expenses;
    expect(expenses[0]).toEqual(originalA);
    expect(expenses[1]).toMatchObject({title:"수정된 B",participantIds:["p1","p2"],participantCountSnapshot:2});

    fireEvent.click(screen.getAllByRole("button", { name: "수정" })[1]);
    fireEvent.click(screen.getAllByRole("button", { name: "수정" })[0]);
    expect((screen.getByLabelText("항목명") as HTMLInputElement).value).toBe("A 숙소");
    expect((screen.getByLabelText("날짜") as HTMLInputElement).value).toBe("2026-08-20");
    expect((screen.getByLabelText("금액") as HTMLInputElement).value).toBe("12.34");
    expect([...screen.getByLabelText("결제자").querySelectorAll("option")].map(option => option.value)).toEqual(["p1"]);

    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "잘못된 금액" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getAllByRole("alert").some(alert => alert.textContent?.includes("USD 금액"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "경비 등록" }));
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect((screen.getByLabelText("항목명") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("날짜") as HTMLInputElement).value).toBe(formatLocalDate(new Date()));
    expect((screen.getByLabelText("금액") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("통화") as HTMLSelectElement).value).toBe("KRW");
    expect((screen.getByLabelText("결제자") as HTMLSelectElement).value).toBe("p1");
    expect((screen.getByLabelText("구분") as HTMLSelectElement).value).toBe("shared");

    fireEvent.change(screen.getByLabelText("항목명"), { target: { value: "새 경비" } });
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expenses = JSON.parse(storage.getItem("our-travel-pocket:v1")!).trip.expenses;
    expect(expenses).toHaveLength(3);
    expect(expenses[0]).toEqual(originalA);
    expect(expenses[2]).toMatchObject({id:"new-expense",title:"새 경비",participantIds:["p1","p2","p3"],participantCountSnapshot:3});
  });

  it("정산 화면에 공동 경비 집계, 최소 송금과 항목별 분할 근거를 표시한다", async () => {
    const storage = new MemoryStorage();
    storage.setItem("our-travel-pocket:v1", JSON.stringify({schemaVersion:1,trip:{id:"t",name:"여행",country:null,startDate:"2026-08-28",endDate:"2026-08-30",participants:[{id:"a",displayName:"아라"},{id:"b",displayName:"보라"}],expenses:[{id:"shared",title:"숙소",expenseDate:"2026-08-28",currency:"KRW",amountMinor:"101",payerParticipantId:"a",kind:"shared",participantIds:["a","b"],participantCountSnapshot:2},{id:"personal",title:"개인 쇼핑",expenseDate:"2026-08-28",currency:"KRW",amountMinor:"999",payerParticipantId:"b",kind:"personal",participantIds:[],participantCountSnapshot:0}]}}));
    render(<AppShell storage={storage} />);
    await screen.findByRole("heading", { name: "여행 정보" });
    fireEvent.click(screen.getByRole("button", { name: "정산" }));
    expect(screen.getByRole("heading", { name: "공동 경비 집계" })).toBeTruthy();
    expect(screen.getAllByText("101 KRW")).toHaveLength(2);
    expect(screen.queryByText("999 KRW")).toBeNull();
    expect(screen.getAllByText("보라").length).toBeGreaterThan(0);
    expect(screen.getByText("스냅샷 인원").nextElementSibling?.textContent).toBe("2명");
    expect(screen.getByText("결제자 나머지").nextElementSibling?.textContent).toBe("1 KRW");
  });
});

describe("formatLocalDate", () => {
  it("현지 자정 직후의 날짜와 한 자리 월·일을 두 자리로 반환한다", () => {
    const localMidnight = { getFullYear: () => 2026, getMonth: () => 0, getDate: () => 2 };
    expect(formatLocalDate(localMidnight)).toBe("2026-01-02");
  });

  it("UTC 날짜와 달라질 수 있어도 현지 날짜 필드만 사용한다", () => {
    const eastOfUtc = { getFullYear: () => 2026, getMonth: () => 7, getDate: () => 27, toISOString: () => "2026-08-26T15:05:00.000Z" };
    expect(formatLocalDate(eastOfUtc)).toBe("2026-08-27");
  });
});
