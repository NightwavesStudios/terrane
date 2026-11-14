import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "explore" }
  | { name: "saved" }
  | { name: "about" }
  | { name: "place"; slug: string };

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
  if (path === "/explore") return { name: "explore" };
  if (path === "/saved") return { name: "saved" };
  if (path === "/about") return { name: "about" };
  const m = path.match(/^\/place\/([a-z0-9-]+)$/);
  if (m) return { name: "place", slug: m[1] };
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
