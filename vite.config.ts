import { getRequestListener } from "@hono/node-server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createApp } from "./src/server/app";
import { MemoryRepository } from "./src/server/memory-repository";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3001";
const api = createApp({
  repo: new MemoryRepository(),
  // Local Vite development has no D1 binding. Use the deployed Site preview
  // for passkey account flows; this server exists for API and UI smoke tests.
  auth: null,
  appOrigin,
});
const apiListener = getRequestListener(api.fetch);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "terrane-api",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if ((request.url ?? "").startsWith("/api/")) {
            apiListener(request, response);
            return;
          }
          next();
        });
      },
    },
  ],
});
