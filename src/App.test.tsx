import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./App";

describe("App", () => {
  it("renders the four-section shell and the Peaks empty state", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/peaks"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(html).toContain("Explore");
    expect(html).toContain("Peaks");
    expect(html).toContain("Lists");
    expect(html).toContain("Progress");
    expect(html).toContain("The mountains are being charted.");
  });

  it("renders the Progress empty state without invented statistics", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/progress"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(html).toContain("Your first ascent starts here.");
    expect(html).toContain("Peaks climbed");
    expect(html).not.toContain("1,234");
  });
});
