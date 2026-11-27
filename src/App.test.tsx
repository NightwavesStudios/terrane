import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./App";

describe("App", () => {
  it("renders the five-section shell and a real atlas", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/atlas"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(html).toContain("Explore");
    expect(html).toContain("Atlas");
    expect(html).toContain("Lists");
    expect(html).toContain("Goals");
    expect(html).toContain("Journal");
    expect(html).toContain("Every way the");
    expect(html).toContain("Everest");
    expect(html).toContain("Mont Blanc");
  });

  it("renders the journal without invented statistics", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/journal"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(html).toContain("The record, not the");
    expect(html).toContain("Summits");
    expect(html).toContain("Your journal is empty.");
    expect(html).not.toContain("1,234");
    expect(html).not.toContain("Sample season");
  });

  it("offers goals and lists as their own surfaces", () => {
    const goals = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/goals"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    const lists = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/lists"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(goals).toContain("Give the season a");
    expect(goals).toContain("The Seven Summits");
    expect(lists).toContain("A list is a way of");
    expect(lists).toContain("The Seven Summits");
  });
});
