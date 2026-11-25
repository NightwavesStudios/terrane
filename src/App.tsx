import { Suspense, lazy, useEffect } from "react";
import { useRoute } from "./lib/router";
import { HOME_META, setMeta } from "./lib/meta";
import StateNotice from "./components/StateNotice";
import Home from "./pages/Home";

/* Home is the landing route, so it stays in the entry chunk; a deep link to a
   place or an experience should not pay for the globe, so those are the splits.
   The experience list and one experience are separate chunks for the same
   reason: opening a route never downloads the catalog, and opening the catalog
   never downloads MapLibre. */
const Place = lazy(() => import("./pages/Place"));
const Experiences = lazy(() => import("./pages/Experiences"));
const Experience = lazy(() => import("./pages/Experience"));
const Collections = lazy(() => import("./pages/Collections"));
const Collection = lazy(() => import("./pages/Collection"));
const Summits = lazy(() => import("./pages/Summits"));
const Saved = lazy(() => import("./pages/Saved"));
const Coverage = lazy(() => import("./pages/Coverage"));

export default function App() {
  const route = useRoute();

  useEffect(() => {
    if (route.name === "home") setMeta(HOME_META);
  }, [route]);

  /* A lazy route used to fall back to an empty div, so a deep link showed a
     blank page for as long as its chunk took. The fallback now reserves the
     page shell and says what is loading. */
  return (
    <Suspense
      fallback={
        <div className={route.name === "home" ? "home home--loading" : "page"}>
          <StateNotice
            kind="loading"
            rows={2}
            title={route.name === "home" ? "Drawing the globe…" : "Opening the page…"}
          />
        </div>
      }
    >
      {route.name === "place" ? (
        <Place slug={route.slug} />
      ) : route.name === "experiences" ? (
        <Experiences />
      ) : route.name === "experience" ? (
        <Experience slug={route.slug} />
      ) : route.name === "collections" ? (
        <Collections />
      ) : route.name === "collection" ? (
        <Collection slug={route.slug} />
      ) : route.name === "summits" ? (
        <Summits listId={route.list} />
      ) : route.name === "saved" ? (
        <Saved />
      ) : route.name === "coverage" ? (
        <Coverage />
      ) : (
        <Home />
      )}
    </Suspense>
  );
}
