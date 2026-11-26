import { useEffect, useState } from "react";

/**
 * Real paths through the History API.
 *
 * The globe is the home. Lists and the log are the two supporting surfaces.
 * Everything that used to be a separate product tab now either has a home here
 * or redirects to one, so old links keep working without a second screen.
 */
export type Route =
  | { name: "home" }
  | { name: "place"; slug: string }
  | { name: "lists"; list?: string }
  | { name: "log" }
  | { name: "experience"; slug: string }
  | { name: "coverage" };

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function navigate(to: string) {
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  emit();
  window.scrollTo({ top: 0 });
}

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "home" };
  if (path === "/log" || path === "/saved") return { name: "log" };
  if (path === "/coverage") return { name: "coverage" };

  if (path === "/lists" || path === "/summits") return { name: "lists" };
  const list = path.match(/^\/(?:lists|summits)\/([a-z0-9-]+)$/);
  if (list) return { name: "lists", list: list[1] };

  /* The curated catalogue's detail pages survive; its browse index does not. */
  const experience = path.match(/^\/experiences\/([a-z0-9-]+)$/);
  if (experience) return { name: "experience", slug: experience[1] };

  const place = path.match(/^\/place\/([a-z0-9-]+)$/);
  if (place) return { name: "place", slug: place[1] };
  return { name: "home" };
}

/**
 * The canonical path for a removed URL.
 *
 * The generated Collections catalogue and the curated Experiences index were
 * both removed when the globe became the browse surface. They are not unknown
 * paths that should fall through the catch-all: a stale link lands on the globe
 * and the address bar is rewritten to it, so an old address never keeps
 * rendering a page that no longer exists. The `/experiences/:slug` detail pages
 * and the `/summits*` and `/saved` aliases are deliberately untouched.
 */
export function redirectFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/experiences") return "/";
  if (path === "/collections" || path.startsWith("/collections/")) return "/";
  return null;
}

export function useRoute(): Route {
  const [path, setPath] = useState(
    () => redirectFor(window.location.pathname) ?? window.location.pathname,
  );

  useEffect(() => {
    const onChange = () => {
      const next = redirectFor(window.location.pathname) ?? window.location.pathname;
      if (next !== window.location.pathname) {
        window.history.replaceState({}, "", next);
      }
      setPath(next);
    };
    /* A direct hit on a removed URL renders its target immediately; this only
       makes the address bar agree with it. */
    onChange();
    listeners.add(onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  return parseRoute(path);
}
