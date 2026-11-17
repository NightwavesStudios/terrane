import { lazy, Suspense, useEffect } from "react";
import { useRoute } from "./lib/router";
import Home from "./pages/Home";

/* Home is the landing route, so it stays in the entry chunk. Everything else is
   split: opening the globe should not pay for the Explore index, and a deep link
   to a place should not pay for either. */
const Explore = lazy(() => import("./pages/Explore"));
const Saved = lazy(() => import("./pages/Saved"));
const About = lazy(() => import("./pages/About"));
const Place = lazy(() => import("./pages/Place"));

export default function App() {
  const route = useRoute();

  useEffect(() => {
    if (route.name !== "place") {
      document.title =
        route.name === "explore"
          ? "Explore — Terrane"
          : route.name === "saved"
            ? "Saved — Terrane"
            : route.name === "about"
              ? "About — Terrane"
              : "Terrane — the world, worth the detour";
    }
  }, [route]);

  return (
    <Suspense fallback={<div className={route.name === "home" ? "home" : "page"} />}>
      {route.name === "explore" ? (
        <Explore />
      ) : route.name === "saved" ? (
        <Saved />
      ) : route.name === "about" ? (
        <About />
      ) : route.name === "place" ? (
        <Place slug={route.slug} />
      ) : (
        <Home />
      )}
    </Suspense>
  );
}
