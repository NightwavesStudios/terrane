import { lazy, Suspense } from "react";
import Discover from "../components/Discover";

const Globe = lazy(() => import("../components/MapGlobe"));

export default function ExplorePage() {
  return (
    <section className="home" aria-label="Terrane globe">
      <Suspense fallback={<div className="globe" aria-hidden="true" />}>
        <Globe />
      </Suspense>
      <div className="globe-veil" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="map-tools">
        <Discover />
      </div>
    </section>
  );
}
