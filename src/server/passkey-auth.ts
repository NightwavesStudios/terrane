import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Profile } from "../types/record";
import type { D1Database } from "./d1";
import type { Repository } from "./repository";
import { ensureSchema } from "./schema";

export const SESSION_COOKIE = "terrane_session";
export const FLOW_COOKIE = "terrane_flow";
export const SESSION_DAYS = 30;
const FLOW_MINUTES = 5;

export interface PasskeyAuth {
  session(token: string | undefined): Promise<Profile | null>;
  registerOptions(input: {
    name: string;
    email?: string;
  }): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; flowId: string }>;
  registerVerify(
    response: RegistrationResponseJSON,
    flowId: string | undefined,
  ): Promise<{ profile: Profile; token: string; recoveryCode: string }>;
  loginOptions(): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; flowId: string }>;
  loginVerify(
    response: AuthenticationResponseJSON,
    flowId: string | undefined,
  ): Promise<{ profile: Profile; token: string }>;
  recovery(code: string): Promise<{ profile: Profile; token: string }>;
  logout(token: string | undefined): Promise<void>;
  addPasskeyOptions(
    profile: Profile,
  ): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; flowId: string }>;
  addPasskeyVerify(
    profile: Profile,
    response: RegistrationResponseJSON,
    flowId: string | undefined,
  ): Promise<void>;
  rotateRecovery(profile: Profile): Promise<string>;
  deleteAccount(userId: string): Promise<void>;
}

export class AuthError extends Error {
  constructor(
    readonly status: 400 | 401 | 409 | 503,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

interface CredentialRow {
  credential_id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string;
}

interface FlowRow {
  id: string;
  kind: string;
  user_id: string | null;
  challenge: string;
  payload: string;
  expires_at: number;
}

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return base64Url(new Uint8Array(digest));
}

function validateName(value: unknown): string {
  if (typeof value !== "string") throw new AuthError(400, "Enter your name.");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) {
    throw new AuthError(400, "Name must be between 1 and 80 characters.");
  }
  return name;
}

function validateEmail(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new AuthError(400, "Enter a valid email address, or leave it blank.");
  }
  return value.trim().toLowerCase();
}

export class D1PasskeyAuth implements PasskeyAuth {
  private readonly rpID: string;

  constructor(
    private readonly db: D1Database,
    private readonly repo: Repository,
    private readonly appOrigin: string,
  ) {
    const url = new URL(appOrigin);
    this.rpID = url.hostname;
  }

  async session(token: string | undefined): Promise<Profile | null> {
    if (!token) return null;
    await ensureSchema(this.db);
    const tokenHash = await hash(token);
    const row = await this.db
      .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .first<{ user_id: string; expires_at: number }>();
    if (!row) return null;
    if (Number(row.expires_at) <= Date.now()) {
      await this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
      return null;
    }
    return this.repo.getProfile(row.user_id);
  }

  async registerOptions(input: {
    name: string;
    email?: string;
  }): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; flowId: string }> {
    await ensureSchema(this.db);
    const name = validateName(input.name);
    const email = validateEmail(input.email);
    const userId = crypto.randomUUID();
    const options = await generateRegistrationOptions({
      rpName: "Terrane",
      rpID: this.rpID,
      userID: encoder.encode(userId),
      userName: email || name,
      userDisplayName: name,
      attestationType: "none",
      timeout: 60_000,
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });
    const flowId = await this.createFlow("register", options.challenge, {
      userId,
      name,
      email,
    });
    return { options, flowId };
  }

  async registerVerify(
    response: RegistrationResponseJSON,
    flowId: string | undefined,
  ): Promise<{ profile: Profile; token: string; recoveryCode: string }> {
    await ensureSchema(this.db);
    const flow = await this.consumeFlow(flowId, "register");
    if (!flow) throw new AuthError(400, "This passkey request expired. Start again.");
    const payload = JSON.parse(flow.payload) as { userId: string; name: string; email: string };

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: flow.challenge,
        expectedOrigin: this.appOrigin,
        expectedRPID: this.rpID,
        requireUserVerification: false,
      });
    } catch {
      throw new AuthError(400, "This passkey could not be verified. Try again.");
    }
    if (!verification.verified) {
      throw new AuthError(400, "This passkey could not be verified. Try again.");
    }

    const profile: Profile = {
      id: payload.userId,
      displayName: payload.name,
      email: payload.email,
      units: "imperial",
      createdAt: new Date().toISOString(),
    };
    await this.repo.createProfile(profile);

    const credential = verification.registrationInfo.credential;
    try {
      await this.db
        .prepare(
          "INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports, device_type, backed_up, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          credential.id,
          profile.id,
          base64Url(credential.publicKey),
          credential.counter,
          JSON.stringify(credential.transports ?? []),
          verification.registrationInfo.credentialDeviceType,
          verification.registrationInfo.credentialBackedUp ? 1 : 0,
          new Date().toISOString(),
        )
        .run();
    } catch (error) {
      await this.repo.deleteAccount(profile.id);
      throw new AuthError(409, "That passkey is already registered. Try signing in.");
    }

    const recoveryCode = randomToken(32);
    await this.db
      .prepare("INSERT INTO recovery_keys (user_id, code_hash, created_at) VALUES (?, ?, ?)")
      .bind(profile.id, await hash(recoveryCode), new Date().toISOString())
      .run();
    const token = await this.createSession(profile.id);
    return { profile, token, recoveryCode };
  }

  async loginOptions(): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    flowId: string;
  }> {
    await ensureSchema(this.db);
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      timeout: 60_000,
      userVerification: "preferred",
    });
    const flowId = await this.createFlow("login", options.challenge, {});
    return { options, flowId };
  }

  async loginVerify(
    response: AuthenticationResponseJSON,
    flowId: string | undefined,
  ): Promise<{ profile: Profile; token: string }> {
    await ensureSchema(this.db);
    const flow = await this.consumeFlow(flowId, "login");
    if (!flow) throw new AuthError(400, "This passkey request expired. Start again.");
    const credential = await this.getCredential(response.id);
    if (!credential) throw new AuthError(401, "That passkey is not linked to a Terrane account.");

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: flow.challenge,
        expectedOrigin: this.appOrigin,
        expectedRPID: this.rpID,
        credential: {
          id: credential.credential_id,
          publicKey: fromBase64Url(credential.public_key),
          counter: Number(credential.counter),
          transports: JSON.parse(credential.transports),
        },
        requireUserVerification: false,
      });
    } catch {
      throw new AuthError(401, "This passkey could not be verified.");
    }
    if (!verification.verified) throw new AuthError(401, "This passkey could not be verified.");

    await this.db
      .prepare("UPDATE webauthn_credentials SET counter = ?, backed_up = ? WHERE credential_id = ?")
      .bind(
        verification.authenticationInfo.newCounter,
        verification.authenticationInfo.credentialBackedUp ? 1 : 0,
        credential.credential_id,
      )
      .run();

    const profile = await this.repo.getProfile(credential.user_id);
    if (!profile) throw new AuthError(401, "That account no longer exists.");
    const token = await this.createSession(profile.id);
    return { profile, token };
  }

  async recovery(code: string): Promise<{ profile: Profile; token: string }> {
    await ensureSchema(this.db);
    const normalized = code.replace(/\s+/g, "");
    if (normalized.length < 20 || normalized.length > 128) {
      throw new AuthError(401, "That recovery key is not valid.");
    }
    const codeHash = await hash(normalized);
    const row = await this.db
      .prepare("SELECT user_id FROM recovery_keys WHERE code_hash = ?")
      .bind(codeHash)
      .first<{ user_id: string }>();
    if (!row) throw new AuthError(401, "That recovery key is not valid.");
    const profile = await this.repo.getProfile(row.user_id);
    if (!profile) throw new AuthError(401, "That recovery key is not valid.");
    const token = await this.createSession(profile.id);
    return { profile, token };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await ensureSchema(this.db);
    await this.db
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await hash(token))
      .run();
  }

  async addPasskeyOptions(
    profile: Profile,
  ): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; flowId: string }> {
    await ensureSchema(this.db);
    const existing = await this.db
      .prepare("SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?")
      .bind(profile.id)
      .all<{ credential_id: string; transports: string }>();
    const options = await generateRegistrationOptions({
      rpName: "Terrane",
      rpID: this.rpID,
      userID: encoder.encode(profile.id),
      userName: profile.email || profile.displayName,
      userDisplayName: profile.displayName,
      attestationType: "none",
      timeout: 60_000,
      excludeCredentials: (existing.results ?? []).map((row) => ({
        id: row.credential_id,
        transports: JSON.parse(row.transports),
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });
    const flowId = await this.createFlow("add-passkey", options.challenge, {
      userId: profile.id,
    });
    return { options, flowId };
  }

  async addPasskeyVerify(
    profile: Profile,
    response: RegistrationResponseJSON,
    flowId: string | undefined,
  ): Promise<void> {
    await ensureSchema(this.db);
    const flow = await this.consumeFlow(flowId, "add-passkey");
    if (!flow || flow.user_id !== profile.id) {
      throw new AuthError(400, "This passkey request expired. Start again.");
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: flow.challenge,
        expectedOrigin: this.appOrigin,
        expectedRPID: this.rpID,
        requireUserVerification: false,
      });
    } catch {
      throw new AuthError(400, "This passkey could not be verified. Try again.");
    }
    if (!verification.verified) {
      throw new AuthError(400, "This passkey could not be verified. Try again.");
    }
    const credential = verification.registrationInfo.credential;
    try {
      await this.db
        .prepare(
          "INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports, device_type, backed_up, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          credential.id,
          profile.id,
          base64Url(credential.publicKey),
          credential.counter,
          JSON.stringify(credential.transports ?? []),
          verification.registrationInfo.credentialDeviceType,
          verification.registrationInfo.credentialBackedUp ? 1 : 0,
          new Date().toISOString(),
        )
        .run();
    } catch {
      throw new AuthError(409, "That passkey is already linked to this account.");
    }
  }

  async rotateRecovery(profile: Profile): Promise<string> {
    await ensureSchema(this.db);
    const code = randomToken(32);
    await this.db
      .prepare(
        "INSERT INTO recovery_keys (user_id, code_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, created_at = excluded.created_at",
      )
      .bind(profile.id, await hash(code), new Date().toISOString())
      .run();
    return code;
  }

  async deleteAccount(userId: string): Promise<void> {
    await ensureSchema(this.db);
    await this.db.batch([
      this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM webauthn_credentials WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM webauthn_flows WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM recovery_keys WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM user_records WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId),
    ]);
  }

  private async getCredential(credentialId: string): Promise<CredentialRow | null> {
    return this.db
      .prepare(
        "SELECT credential_id, user_id, public_key, counter, transports FROM webauthn_credentials WHERE credential_id = ?",
      )
      .bind(credentialId)
      .first<CredentialRow>();
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomToken(32);
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    await this.db
      .prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .bind(await hash(token), userId, expiresAt, new Date().toISOString())
      .run();
    return token;
  }

  private async createFlow(
    kind: string,
    challenge: string,
    payload: Record<string, string>,
  ): Promise<string> {
    const id = randomToken(18);
    await this.db
      .prepare("DELETE FROM webauthn_flows WHERE expires_at <= ?")
      .bind(Date.now())
      .run();
    await this.db
      .prepare(
        "INSERT INTO webauthn_flows (id, kind, user_id, challenge, payload, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        kind,
        payload.userId ?? null,
        challenge,
        JSON.stringify(payload),
        Date.now() + FLOW_MINUTES * 60 * 1000,
      )
      .run();
    return id;
  }

  private async consumeFlow(flowId: string | undefined, kind: string): Promise<FlowRow | null> {
    if (!flowId) return null;
    const row = await this.db
      .prepare("SELECT id, kind, user_id, challenge, payload, expires_at FROM webauthn_flows WHERE id = ?")
      .bind(flowId)
      .first<FlowRow>();
    if (!row) return null;
    await this.db.prepare("DELETE FROM webauthn_flows WHERE id = ?").bind(flowId).run();
    if (row.kind !== kind || Number(row.expires_at) <= Date.now()) return null;
    return row;
  }
}
