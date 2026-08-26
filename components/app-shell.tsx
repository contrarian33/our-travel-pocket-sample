"use client";

export const SHELL_COPY = {
  title: "Our Travel Pocket",
  eyebrow: "금요일 여행용 단일 기기 실험판",
  status: "여행 데이터를 확인하는 중입니다",
  storageNotice: "여행 데이터는 이 브라우저에만 저장됩니다.",
} as const;

export const NAVIGATION_ITEMS = ["여행", "경비", "정산"] as const;

export function AppShell() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-10">
      <div className="flex flex-1 items-center py-6">
        <section
          aria-labelledby="app-title"
          aria-busy="true"
          className="w-full min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(36,107,75,0.08)]"
        >
          <p className="text-sm font-semibold text-[var(--accent)]">
            {SHELL_COPY.eyebrow}
          </p>
          <h1 id="app-title" className="mt-3 text-3xl font-bold tracking-tight">
            {SHELL_COPY.title}
          </h1>

          <div role="status" className="mt-10 flex items-center gap-3" aria-live="polite">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 animate-pulse rounded-full bg-[var(--accent)]"
            />
            <p className="text-base font-medium">{SHELL_COPY.status}</p>
          </div>

          <p className="mt-5 border-t border-[var(--border)] pt-5 text-sm leading-6 text-[var(--muted)]">
            {SHELL_COPY.storageNotice}
          </p>
        </section>
      </div>

      <nav aria-label="모바일 주요 메뉴" className="sticky bottom-0 -mx-5 border-t border-[var(--border)] bg-[var(--surface)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <ul className="grid grid-cols-3 gap-2">
          {NAVIGATION_ITEMS.map((item) => (
            <li key={item} className="min-w-0">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="min-h-11 w-full cursor-not-allowed rounded-xl px-2 text-sm font-semibold text-[var(--muted)] opacity-60"
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
