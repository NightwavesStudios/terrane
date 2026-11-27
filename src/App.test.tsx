import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";

describe("App", () => {
  it("renders the application name", () => {
    expect(renderToStaticMarkup(<App />)).toContain("<h1>Terrane</h1>");
  });
});
