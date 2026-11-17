import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* Start pulling the globe's chunk the moment the app boots on the landing route
   instead of waiting for React to mount and ask for it. It is the same module
   Home lazily imports, so this only moves the request earlier — it never loads
   the map twice. */
if (window.location.pathname === "/") void import("./map/Globe");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
