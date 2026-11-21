import { describe, expect, it } from "vitest";
import {
  DEAD,
  UNREACHABLE,
  VERIFIED,
  buildArtifact,
  classifyFetchError,
  classifySource,
  summarize,
} from "./source-check.mjs";

const ARTICLE = "https://en.wikipedia.org/wiki/Mount_Kazbek";
const FILE = "https://commons.wikimedia.org/wiki/File:Kazbek.jpg";

const article = (overrides = {}) =>
  classifySource({
    kind: "article",
    requestedUrl: ARTICLE,
    status: 200,
    finalUrl: ARTICLE,
    body: "Mount Kazbek is a dormant volcano in Georgia.",
    ...overrides,
  });

describe("classifySource: articles", () => {
  it("verifies an article that lands on itself", () => {
    expect(article()).toEqual({ status: VERIFIED });
  });

  it("follows a redirect to a renamed article", () => {
    expect(
      article({ finalUrl: "https://en.wikipedia.org/wiki/Mount_Kazbek_(Georgia)" }),
    ).toEqual({ status: VERIFIED });
  });

  it("treats 404 and 410 as dead", () => {
    expect(article({ status: 404 })).toEqual({ status: DEAD, reason: "http-404" });
    expect(article({ status: 410 })).toEqual({ status: DEAD, reason: "http-410" });
  });

  it("treats rate limits and server errors as unreachable, not dead", () => {
    expect(article({ status: 429 }).status).toBe(UNREACHABLE);
    expect(article({ status: 503 }).status).toBe(UNREACHABLE);
  });

  it("rejects a redirect to search or a special page", () => {
    expect(
      article({
        finalUrl: "https://en.wikipedia.org/w/index.php?search=Mount+Kazbek",
      }),
    ).toEqual({ status: DEAD, reason: "redirected-to-search" });
    expect(
      article({ finalUrl: "https://en.wikipedia.org/wiki/Special:Search" }),
    ).toEqual({ status: DEAD, reason: "redirected-to-special" });
  });

  it("rejects a redirect to the main page or off Wikipedia", () => {
    expect(
      article({ finalUrl: "https://en.wikipedia.org/wiki/Main_Page" }),
    ).toEqual({ status: DEAD, reason: "redirected-to-main-page" });
    expect(
      article({ finalUrl: "https://example.com/wiki/Mount_Kazbek" }),
    ).toEqual({ status: DEAD, reason: "left-wikipedia" });
  });

  it("rejects a 200 page that says the article does not exist", () => {
    expect(
      article({ body: "Wikipedia does not have an article with this exact name." }),
    ).toEqual({ status: DEAD, reason: "article-does-not-exist" });
  });
});

describe("classifySource: Commons file pages", () => {
  const file = (overrides = {}) =>
    classifySource({
      kind: "file",
      requestedUrl: FILE,
      status: 200,
      finalUrl: FILE,
      body: "File:Kazbek.jpg",
      ...overrides,
    });

  it("verifies a real file page", () => {
    expect(file()).toEqual({ status: VERIFIED });
  });

  it("rejects a non-file page or a missing file", () => {
    expect(
      file({ finalUrl: "https://commons.wikimedia.org/wiki/Category:Mount_Kazbek" }),
    ).toEqual({ status: DEAD, reason: "not-a-file-page" });
    expect(file({ body: "This page does not exist." })).toEqual({
      status: DEAD,
      reason: "file-does-not-exist",
    });
  });
});

describe("classifyFetchError", () => {
  it("classifies timeouts and network failures as unreachable", () => {
    expect(classifyFetchError(new Error("The operation was aborted"))).toEqual({
      status: UNREACHABLE,
      reason: "timeout",
    });
    expect(classifyFetchError(new Error("fetch failed"))).toEqual({
      status: UNREACHABLE,
      reason: "network",
    });
  });

  it("classifies a redirect loop as dead", () => {
    expect(classifyFetchError(new Error("redirect count exceeded"))).toEqual({
      status: DEAD,
      reason: "redirect-loop",
    });
  });
});

describe("artifact", () => {
  const entries = new Map([
    [ARTICLE, { kind: "article", status: VERIFIED, http: 200, final: ARTICLE }],
    [
      "https://en.wikipedia.org/wiki/Missing",
      { kind: "article", status: DEAD, http: 404, final: "https://en.wikipedia.org/wiki/Missing", reason: "http-404" },
    ],
    [
      FILE,
      { kind: "file", status: UNREACHABLE, http: 0, final: FILE, reason: "timeout" },
    ],
  ]);

  it("reconciles every count and sorts URLs", () => {
    const summary = summarize(entries);
    expect(summary.counts).toEqual({
      urls: 3,
      articles: 2,
      filePages: 1,
      verified: 1,
      dead: 1,
      unreachable: 1,
    });
    expect(Object.keys(summary.urls)).toEqual(
      [...entries.keys()].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("is deterministic regardless of insertion order", () => {
    const reversed = new Map([...entries.entries()].reverse());
    expect(JSON.stringify(buildArtifact(entries, "2026-11-20"))).toBe(
      JSON.stringify(buildArtifact(reversed, "2026-11-20")),
    );
  });
});
