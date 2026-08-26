import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell, NAVIGATION_ITEMS, SHELL_COPY } from "./app-shell";

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
});
