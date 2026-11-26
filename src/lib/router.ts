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

export function useRoute(): Route {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    listeners.add(onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  return parseRoute(path);
}
