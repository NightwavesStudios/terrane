import { createApp } from "../src/server/app";
import { D1Repository } from "../src/server/d1-repository";
import type { D1Database } from "../src/server/d1";
import { D1PasskeyAuth } from "../src/server/passkey-auth";

interface Assets {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1Database;
  ASSETS: Assets;
  APP_ORIGIN: string;
}

interface Runtime {
  key: string;
  handler: (request: Request, env: Env) => Promise<Response>;
}

let runtime: Runtime | undefined;

function setup(env: Env): Runtime {
  const key = env.APP_ORIGIN;
  if (runtime?.key === key) return runtime;

  const repo = new D1Repository(env.DB);
  const auth = new D1PasskeyAuth(env.DB, repo, env.APP_ORIGIN);
  const app = createApp({
    repo,
    auth,
    appOrigin: env.APP_ORIGIN,
  });

  const handler = async (request: Request, innerEnv: Env) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request);
    }
    return innerEnv.ASSETS.fetch(request);
  };

  runtime = { key, handler };
  return runtime;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return setup(env).handler(request, env);
  },
};
