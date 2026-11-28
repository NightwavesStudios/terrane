import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { RecordData } from "../types/account";
import type { Profile } from "../types/record";
import {
  AuthError,
  FLOW_COOKIE,
  SESSION_COOKIE,
  SESSION_DAYS,
  type PasskeyAuth,
} from "./passkey-auth";
import { parseRecordData } from "./record-schema";
import { RevisionConflict, type Repository } from "./repository";

interface AppVariables {
  user: Profile;
}

type AppContext = Context<{ Variables: AppVariables }>;

export interface AppOptions {
  repo: Repository;
  appOrigin: string;
  auth?: PasskeyAuth | null;
  /** Test seam for route-level account isolation tests. */
  getUser?: (request: Request) => Promise<Profile | null>;
}

function problem(status: number, title: string, detail: string, extra: object = {}) {
  return Response.json(
    {
      type: "about:blank",
      title,
      status,
      detail,
      ...extra,
    },
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "private, no-store",
      },
    },
  );
}

function sameOrigin(request: Request, origin: string): boolean {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin) return requestOrigin === origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
}

const profilePatch = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    units: z.enum(["imperial", "metric"]).optional(),
  })
  .refine((value) => value.displayName !== undefined || value.units !== undefined, {
    message: "Provide a name or units.",
  });

const recordPut = z.object({
  revision: z.number().int().min(0).max(1_000_000),
  record: z.unknown(),
});

const credentials = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().max(254).optional(),
});

const registrationResponse = z.object({
  response: z.unknown(),
});

const recoveryBody = z.object({
  code: z.string().min(1).max(200),
});

export function createApp({ repo, appOrigin, auth = null, getUser }: AppOptions) {
  const app = new Hono<{ Variables: AppVariables }>();
  const origin = appOrigin.replace(/\/$/, "");
  const secure = origin.startsWith("https://");

  async function currentUser(c: AppContext): Promise<Profile | null> {
    if (getUser) return getUser(c.req.raw);
    if (!auth) return null;
    return auth.session(getCookie(c, SESSION_COOKIE));
  }

  async function loadProfile(user: Profile): Promise<Profile> {
    return (await repo.getProfile(user.id)) ?? (await repo.createProfile(user));
  }

  function setSession(c: AppContext, token: string) {
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
  }

  function setFlow(c: AppContext, flowId: string) {
    setCookie(c, FLOW_COOKIE, flowId, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: 5 * 60,
    });
  }

  function authError(_c: AppContext, error: unknown) {
    if (error instanceof AuthError) return problem(error.status, "Account", error.message);
    throw error;
  }

  app.use("/api/*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    await next();
  });

  app.get("/api/health", (c) =>
    c.json({ ok: true, storage: "d1", accounts: "passkey" }),
  );

  app.use("/api/*", async (c, next) => {
    const method = c.req.method.toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      if (!sameOrigin(c.req.raw, origin)) {
        return problem(403, "Forbidden", "This request did not come from Terrane.");
      }
    }
    await next();
  });

  app.post("/api/auth/register/options", async (c) => {
    if (!auth) return problem(503, "Accounts unavailable", "Sign-in is not configured here.");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(400, "Invalid request", "Expected a JSON body.");
    }
    const parsed = credentials.safeParse(body);
    if (!parsed.success) return problem(400, "Invalid account", "Enter your name.");
    try {
      const result = await auth.registerOptions(parsed.data);
      setFlow(c, result.flowId);
      return c.json({ options: result.options });
    } catch (error) {
      return authError(c, error);
    }
  });

  app.post("/api/auth/register/verify", async (c) => {
    if (!auth) return problem(503, "Accounts unavailable", "Sign-in is not configured here.");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(400, "Invalid request", "Expected a JSON body.");
    }
    const parsed = registrationResponse.safeParse(body);
    if (!parsed.success) return problem(400, "Invalid passkey", "The passkey response is missing.");
    try {
      const result = await auth.registerVerify(
        parsed.data.response as Parameters<PasskeyAuth["registerVerify"]>[0],
        getCookie(c, FLOW_COOKIE),
      );
      deleteCookie(c, FLOW_COOKIE, { path: "/" });
      setSession(c, result.token);
      return c.json({ profile: result.profile, recoveryCode: result.recoveryCode });
    } catch (error) {
      return authError(c, error);
    }
  });

  app.post("/api/auth/login/options", async (c) => {
    if (!auth) return problem(503, "Accounts unavailable", "Sign-in is not configured here.");
    try {
      const result = await auth.loginOptions();
      setFlow(c, result.flowId);
      return c.json({ options: result.options });
    } catch (error) {
      return authError(c, error);
    }
  });

  app.post("/api/auth/login/verify", async (c) => {
    if (!auth) return problem(503, "Accounts unavailable", "Sign-in is not configured here.");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(400, "Invalid request", "Expected a JSON body.");
    }
    const parsed = registrationResponse.safeParse(body);
    if (!parsed.success) return problem(400, "Invalid passkey", "The passkey response is missing.");
    try {
      const result = await auth.loginVerify(
        parsed.data.response as Parameters<PasskeyAuth["loginVerify"]>[0],
        getCookie(c, FLOW_COOKIE),
      );
      deleteCookie(c, FLOW_COOKIE, { path: "/" });
      setSession(c, result.token);
      return c.json({ profile: result.profile });
    } catch (error) {
      return authError(c, error);
    }
  });

  app.post("/api/auth/recovery", async (c) => {
    if (!auth) return problem(503, "Accounts unavailable", "Sign-in is not configured here.");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(400, "Invalid request", "Expected a JSON body.");
    }
    const parsed = recoveryBody.safeParse(body);
    if (!parsed.success) return problem(400, "Invalid recovery key", "Enter your recovery key.");
    try {
      const result = await auth.recovery(parsed.data.code);
      setSession(c, result.token);
      return c.json({ profile: result.profile });
    } catch (error) {
      return authError(c, error);
    }
  });

  app.post("/api/auth/logout", async (c) => {
    if (auth) await auth.logout(getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  app.use("/api/me", async (c, next) => {
    const user = await currentUser(c);
    if (!user) {
      return problem(401, "Sign in required", "Sign in with a passkey to open this record.");
    }
    c.set("user", user);
    await next();
  });

  app.use("/api/record", async (c, next) => {
    const user = await currentUser(c);
    if (!user) {
      return problem(401, "Sign in required", "Sign in with a passkey to open this record.");
    }
    c.set("user", user);
    await next();
  });

  app.get("/api/me", async (c) => {
    const user = await loadProfile(c.get("user"));
    const snapshot = await repo.getRecord(user);
    return c.json(snapshot);
  });

  app.patch("/api/me", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(400, "Invalid request", "Expected a JSON body.");
    }
    const parsed = profilePatch.safeParse(body);
    if (!parsed.success) {
      return problem(400, "Invalid profile", parsed.error.issues[0]?.message ?? "Check the profile fields.");
    }
    const user = await loadProfile(c.get("user"));
    const profile: Profile = await repo.updateProfile(user.id, parsed.data);
    return c.json({ profile });
  });

  app.put("/api/record", async (c) => {
    const length = Number(c.req.header("content-length") ?? 0);
    if (length > 1_200_000) {
      return problem(413, "Record too large", "This record exceeds the server limit.");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(400, "Invalid request", "Expected a JSON body.");
    }
    const envelope = recordPut.safeParse(body);
    if (!envelope.success) {
      return problem(400, "Invalid revision", "The record revision is missing or invalid.");
    }

    let record: RecordData;
    try {
      record = parseRecordData(envelope.data.record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return problem(
          400,
          "Invalid record",
          error.issues[0]?.message ?? "The record contains an unsupported field.",
        );
      }
      return problem(400, "Invalid record", "The record could not be read.");
    }

    const user = await loadProfile(c.get("user"));
    try {
      const result = await repo.saveRecord(user, record, envelope.data.revision);
      return c.json(result);
    } catch (error) {
      if (error instanceof RevisionConflict) {
        return problem(
          409,
          "Record changed",
          "This record changed in another session. Reload and try again.",
          {
            revision: error.current.revision,
            record: error.current.record,
          },
        );
      }
      throw error;
    }
  });

  app.post("/api/auth/passkey/options", async (c) => {
    if (!auth) return problem(503, "Accounts unavailable", "Sign-in is not configured here.");
    const user = await currentUser(c);
    if (!user) return problem(401, "Sign in required", "Sign in to add a passkey.");
    try {
      const result = await auth.addPasskeyOptions(user);
      setFlow(c, result.flowId);
      return c.json({ options: result.options });
    } catch (error) {
      return authError(c, error);
    }
  });

  app.post("/api/auth/passkey/verify", async (c) => {
    if (!auth) return problem(503, "Accounts unavailable", "Sign-in is not configured here.");
    const user = await currentUser(c);
    if (!user) return problem(401, "Sign in required", "Sign in to add a passkey.");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(400, "Invalid request", "Expected a JSON body.");
    }
    const parsed = registrationResponse.safeParse(body);
    if (!parsed.success) return problem(400, "Invalid passkey", "The passkey response is missing.");
    try {
      await auth.addPasskeyVerify(
        user,
        parsed.data.response as Parameters<PasskeyAuth["addPasskeyVerify"]>[1],
        getCookie(c, FLOW_COOKIE),
      );
      deleteCookie(c, FLOW_COOKIE, { path: "/" });
      return c.json({ ok: true });
    } catch (error) {
      return authError(c, error);
    }
  });

  app.post("/api/auth/recovery/rotate", async (c) => {
    if (!auth) return problem(503, "Accounts unavailable", "Sign-in is not configured here.");
    const user = await currentUser(c);
    if (!user) return problem(401, "Sign in required", "Sign in to rotate your recovery key.");
    try {
      const code = await auth.rotateRecovery(user);
      return c.json({ recoveryCode: code });
    } catch (error) {
      return authError(c, error);
    }
  });

  app.delete("/api/me", async (c) => {
    const user = c.get("user");
    if (auth) {
      await auth.deleteAccount(user.id);
    }
    await repo.deleteAccount(user.id);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  app.notFound(() => problem(404, "Not found", "No API route matches this path."));

  app.onError((error) => {
    console.error("Terrane API error", error instanceof Error ? error.message : "unknown");
    return problem(500, "Server error", "The record could not be saved. Try again.");
  });

  return app;
}
