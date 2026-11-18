import { lazy, Suspense, useEffect } from "react";
import { useRoute } from "./lib/router";
import Home from "./pages/Home";

/* Home is the landing route, so it stays in the entry chunk; a deep link to a
   place should not pay for the globe, so that is the only split left. */
const Place = lazy(() => import("./pages/Place"));

export default function App() {
  const route = useRoute();

  useEffect(() => {
    if (route.name !== "place") {
      document.title = "Terrane — the world, worth the detour";
    }
  }, [route]);

  return (
    <Suspense fallback={<div className={route.name === "home" ? "home" : "page"} />}>
      {route.name === "place" ? <Place slug={route.slug} /> : <Home />}
    </Suspense>
  );
}
