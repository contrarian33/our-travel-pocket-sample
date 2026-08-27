import { expect, test } from "@playwright/test";

test("360px에서 여행·일행·경비·정산과 새로고침 복원을 완료한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "여행을 시작해 볼까요?" })).toBeVisible();
  await expect(page.getByText(/백업과 복구 기능이 없습니다/)).toBeVisible();

  await page.getByLabel("여행 이름").fill("도쿄 여행");
  await page.getByLabel("국가 (선택)").fill("일본");
  await page.getByLabel("시작일").fill("2026-08-28");
  await page.getByLabel("종료일").fill("2026-08-30");
  await page.getByRole("button", { name: "여행 시작" }).click();

  const participant = page.getByLabel("일행 표시 이름");
  await participant.fill("아라");
  await page.getByRole("button", { name: "추가" }).click();
  await participant.fill("보라");
  await page.getByRole("button", { name: "추가" }).click();

  await page.getByRole("button", { name: "경비", exact: true }).click();
  await page.getByRole("button", { name: "경비 등록" }).click();
  await page.getByLabel("항목명").fill("숙소");
  await page.getByLabel("날짜", { exact: true }).fill("2026-08-28");
  await page.getByLabel("금액").fill("101");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("101 KRW")).toBeVisible();

  await page.getByRole("button", { name: "정산", exact: true }).click();
  await expect(page.getByRole("heading", { name: "공동 경비 집계" })).toBeVisible();
  await expect(page.getByText("결제자 나머지").locator("xpath=following-sibling::dd")).toHaveText("1 KRW");
  await expect(page.getByText("보라").first()).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
  const undersizedButtons = await page.locator("main").getByRole("button").evaluateAll((buttons) => buttons.map((button) => ({ name: button.textContent?.trim(), height: button.getBoundingClientRect().height })).filter(({ height }) => height > 0 && height < 44));
  expect(undersizedButtons).toEqual([]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "도쿄 여행" })).toBeVisible();
  await page.getByRole("button", { name: "정산", exact: true }).click();
  await expect(page.getByRole("heading", { name: "숙소" })).toBeVisible();
});

test("손상 데이터는 노출하지 않고 확인 후 초기화한다", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("our-travel-pocket:v1", "{"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "저장 데이터를 사용할 수 없습니다" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "전체 데이터 초기화" }).click();
  await expect(page.getByRole("heading", { name: "여행을 시작해 볼까요?" })).toBeVisible();
});
