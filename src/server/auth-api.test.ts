import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { D1Repository } from "./d1-repository";
import type { D1Database } from "./d1";
import { D1PasskeyAuth } from "./passkey-auth";

const ORIGIN = "https://terrane.test";

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(async (input: { userName: string }) => ({
    challenge: "registration-challenge",
    rp: { id: "terrane.test", name: "Terrane" },
    user: { id: "dXNlcg", name: input.userName, displayName: "Avery Stone" },
    pubKeyCredParams: [],
  })),
  generateAuthenticationOptions: vi.fn(async () => ({
    challenge: "authentication-challenge",
    rpId: "terrane.test",
  })),
  verifyRegistrationResponse: vi.fn(async ({ response }: { response: { id: string } }) => ({
    verified: true,
    registrationInfo: {
      fmt: "none",
      aaguid: "00000000-0000-0000-0000-000000000000",
      credential: {
        id: response.id,
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["internal"],
      },
      credentialType: "public-key",
      attestationObject: new Uint8Array(),
      userVerified: true,
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
      origin: ORIGIN,
      rpID: "terrane.test",
    },
  })),
  verifyAuthenticationResponse: vi.fn(
    async ({ response, credential }: { response: { id: string }; credential: { id: string } }) => ({
      verified: response.id === credential.id,
      authenticationInfo: {
        credentialID: credential.id,
        newCounter: 1,
        userVerified: true,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        origin: ORIGIN,
        rpID: "terrane.test",
      },
    }),
  ),
}));

function cookieFrom(response: Response, name: string): string {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  if (!match) throw new Error(`Missing ${name} cookie in ${header}`);
  return `${name}=${match[1]}`;
}

describe("passkey account API", () => {
  let mf: Miniflare;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: ["DB"],
      compatibilityDate: "2026-11-27",
    });
    const db = (await mf.getD1Database("DB")) as unknown as D1Database;
    const repo = new D1Repository(db);
    const auth = new D1PasskeyAuth(db, repo, ORIGIN);
    app = createApp({ repo, auth, appOrigin: ORIGIN });
  });

  afterAll(async () => {
    await mf.dispose();
  });

  function call(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (init.method && init.method !== "GET") headers.set("Origin", ORIGIN);
    return app.request(`${ORIGIN}${path}`, { ...init, headers });
  }

  async function createAccount(name: string, id: string) {
    const options = await call("/api/auth/register/options", {
      method: "POST",
      body: JSON.stringify({ name, email: `${id}@example.com` }),
    });
    expect(options.status).toBe(200);
    const flow = cookieFrom(options, "terrane_flow");
    const verified = await call("/api/auth/register/verify", {
      method: "POST",
      headers: { Cookie: flow },
      body: JSON.stringify({ response: { id } }),
    });
    expect(verified.status).toBe(200);
    const body = (await verified.json()) as {
      profile: { id: string; displayName: string };
      recoveryCode: string;
    };
    return {
      profile: body.profile,
      recoveryCode: body.recoveryCode,
      session: cookieFrom(verified, "terrane_session"),
    };
  }

  it("creates a passkey account, stores a record, and returns as a returning user", async () => {
    const account = await createAccount("Avery Stone", "credential-avery");
    expect(account.profile.displayName).toBe("Avery Stone");
    expect(account.recoveryCode).toHaveLength(43);

    const me = await call("/api/me", { headers: { Cookie: account.session } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      revision: 0,
      record: { trips: [] },
      profile: { displayName: "Avery Stone" },
    });

    const saved = await call("/api/record", {
      method: "PUT",
      headers: { Cookie: account.session },
      body: JSON.stringify({
        revision: 0,
        record: {
          startedLists: ["nh48"],
          listStarts: {},
          badges: [],
          listCompletions: [],
          trips: [],
        },
      }),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ revision: 1 });

    const logout = await call("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: account.session },
    });
    expect(logout.status).toBe(204);
    expect((await call("/api/me", { headers: { Cookie: account.session } })).status).toBe(401);

    const options = await call("/api/auth/login/options", { method: "POST" });
    const flow = cookieFrom(options, "terrane_flow");
    const login = await call("/api/auth/login/verify", {
      method: "POST",
      headers: { Cookie: flow },
      body: JSON.stringify({ response: { id: "credential-avery" } }),
    });
    expect(login.status).toBe(200);
    const session = cookieFrom(login, "terrane_session");
    const returning = await call("/api/me", { headers: { Cookie: session } });
    expect(await returning.json()).toMatchObject({
      revision: 1,
      record: { startedLists: ["nh48"] },
    });
  });

  it("recovers an account with the one-time key and isolates another account", async () => {
    const first = await createAccount("Avery Stone", "credential-recover");
    const recovered = await call("/api/auth/recovery", {
      method: "POST",
      body: JSON.stringify({ code: first.recoveryCode }),
    });
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ profile: { displayName: "Avery Stone" } });

    const invalid = await call("/api/auth/recovery", {
      method: "POST",
      body: JSON.stringify({ code: "not-a-real-recovery-key-value" }),
    });
    expect(invalid.status).toBe(401);

    const second = await createAccount("Blair", "credential-blair");
    const secondMe = await call("/api/me", { headers: { Cookie: second.session } });
    expect(await secondMe.json()).toMatchObject({
      profile: { displayName: "Blair" },
      revision: 0,
      record: { trips: [] },
    });
  });

  it("adds a passkey, rotates the recovery key, and deletes the whole account", async () => {
    const account = await createAccount("Avery Stone", "credential-primary");

    const options = await call("/api/auth/passkey/options", {
      method: "POST",
      headers: { Cookie: account.session },
    });
    const flow = cookieFrom(options, "terrane_flow");
    const added = await call("/api/auth/passkey/verify", {
      method: "POST",
      headers: { Cookie: `${account.session}; ${flow}` },
      body: JSON.stringify({ response: { id: "credential-secondary" } }),
    });
    expect(added.status).toBe(200);

    const rotated = await call("/api/auth/recovery/rotate", {
      method: "POST",
      headers: { Cookie: account.session },
    });
    expect(rotated.status).toBe(200);
    const { recoveryCode } = (await rotated.json()) as { recoveryCode: string };
    expect(recoveryCode).not.toBe(account.recoveryCode);

    const oldCode = await call("/api/auth/recovery", {
      method: "POST",
      body: JSON.stringify({ code: account.recoveryCode }),
    });
    expect(oldCode.status).toBe(401);
    const newCode = await call("/api/auth/recovery", {
      method: "POST",
      body: JSON.stringify({ code: recoveryCode }),
    });
    expect(newCode.status).toBe(200);

    const deleted = await call("/api/me", {
      method: "DELETE",
      headers: { Cookie: account.session },
    });
    expect(deleted.status).toBe(204);
    expect((await call("/api/me", { headers: { Cookie: account.session } })).status).toBe(401);
    const gone = await call("/api/auth/recovery", {
      method: "POST",
      body: JSON.stringify({ code: recoveryCode }),
    });
    expect(gone.status).toBe(401);
  });

  it("rejects foreign origins and an expired flow without creating an account", async () => {
    const foreign = await app.request(`${ORIGIN}/api/auth/register/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://not-terrane.example" },
      body: JSON.stringify({ name: "Mallory" }),
    });
    expect(foreign.status).toBe(403);

    const options = await call("/api/auth/register/options", {
      method: "POST",
      body: JSON.stringify({ name: "No Flow" }),
    });
    expect(options.status).toBe(200);
    const missing = await call("/api/auth/register/verify", {
      method: "POST",
      body: JSON.stringify({ response: { id: "credential-no-flow" } }),
    });
    expect(missing.status).toBe(400);
  });
});
