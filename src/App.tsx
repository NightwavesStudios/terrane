import { useEffect } from "react";
import { useRoute } from "./lib/router";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Saved from "./pages/Saved";
import About from "./pages/About";
import Place from "./pages/Place";

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

  if (route.name === "explore") return <Explore />;
  if (route.name === "saved") return <Saved />;
  if (route.name === "about") return <About />;
  if (route.name === "place") return <Place slug={route.slug} />;
  return <Home />;
}
