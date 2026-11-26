import { Suspense, lazy, useEffect } from "react";
import { useRoute } from "./lib/router";
import { HOME_META, setMeta } from "./lib/meta";
import StateNotice from "./components/StateNotice";
import Home from "./pages/Home";

/* Home is the landing route, so it stays in the entry chunk; a deep link to a
   place, a list or the log should not pay for the globe, so those are the
   splits. There is no catalogue index any more: a curated experience survives
   as a detail page, and Lists is the sourced ledger. */
const Place = lazy(() => import("./pages/Place"));
const Experience = lazy(() => import("./pages/Experience"));
const Lists = lazy(() => import("./pages/Lists"));
const LogPage = lazy(() => import("./pages/Log"));
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
      ) : route.name === "experience" ? (
        <Experience slug={route.slug} />
      ) : route.name === "lists" ? (
        <Lists listId={route.list} />
      ) : route.name === "log" ? (
        <LogPage />
      ) : route.name === "coverage" ? (
        <Coverage />
      ) : (
        <Home />
      )}
    </Suspense>
  );
}
