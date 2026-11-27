import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./App";

function renderAt(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("renders the four-section shell and the 106-peak index", () => {
    const html = renderAt("/peaks");

    expect(html).toContain("Explore");
    expect(html).toContain("Peaks");
    expect(html).toContain("Lists");
    expect(html).toContain("Progress");
    expect(html).toContain("106 peaks indexed");
    expect(html).toContain("Mount Elbert");
    expect(html).toContain("14,438 ft");
    expect(html).toContain("Mount Washington");
  });

  it("renders the Progress empty state without invented statistics", () => {
    const html = renderAt("/progress");

    expect(html).toContain("Your first");
    expect(html).toContain("ascent");
    expect(html).toContain("No record yet");
    expect(html).toContain("Start with one summit.");
    expect(html).not.toContain("1,234");
  });

  it("renders the NH 48 list and its 48 rows", () => {
    const html = renderAt("/lists/nh48");

    expect(html).toContain("The");
         expect(html).toContain("New Hampshire 48.");
    expect(html).toContain("All 48 peaks");
    expect(html).toContain("Not started");
    expect(html).toContain("Mount Tecumseh");
  });

  it("renders the sign-in surface and both list sources", () => {
    const signIn = renderAt("/signin");
    expect(signIn).toContain("A record that");
    expect(signIn).toContain("Local-first");

    const data = renderAt("/about/data");
    expect(data).toContain("Facts with a");
    expect(data).toContain("NH48.info catalog");
    expect(data).toContain("OpenStreetMap");
    expect(data).toContain("58 named summits");
  });

  it("renders the Colorado list without pretending it is the CMC 54", () => {
    const html = renderAt("/lists/co14ers");
    expect(html).toContain("All 58 peaks");
    expect(html).toContain("Colorado Mountain Club recognises 54");
    expect(html).toContain("Mount Elbert");
  });
});
