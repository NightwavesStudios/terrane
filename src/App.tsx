import { lazy, Suspense, useEffect } from "react";
import { useRoute } from "./lib/router";
import { HOME_META, setMeta } from "./lib/meta";
import Home from "./pages/Home";

/* Home is the landing route, so it stays in the entry chunk; a deep link to a
   place should not pay for the globe, so that is the only split left. */
const Place = lazy(() => import("./pages/Place"));
const Saved = lazy(() => import("./pages/Saved"));
const Coverage = lazy(() => import("./pages/Coverage"));

export default function App() {
  const route = useRoute();

  useEffect(() => {
    if (route.name === "home") setMeta(HOME_META);
  }, [route]);

  return (
    <Suspense fallback={<div className={route.name === "home" ? "home" : "page"} />}>
      {route.name === "place" ? (
        <Place slug={route.slug} />
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
