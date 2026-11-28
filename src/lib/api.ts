import {
  startAuthentication,
  startRegistration,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import type { RecordData, AccountSession } from "../types/account";
import type { Profile } from "../types/record";

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed with ${response.status}.`;
    throw new ApiError(detail, response.status, payload);
  }

  return payload as T;
}

export async function fetchAccount(): Promise<AccountSession> {
  return request<AccountSession>("/api/me");
}

export async function saveRecord(record: RecordData, revision: number): Promise<{ revision: number }> {
  return request<{ revision: number }>("/api/record", {
    method: "PUT",
    body: JSON.stringify({ record, revision }),
  });
}

export async function updateAccountProfile(patch: {
  displayName?: string;
  units?: Profile["units"];
}): Promise<{ profile: Profile }> {
  return request<{ profile: Profile }>("/api/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteAccount(): Promise<void> {
  await request<void>("/api/me", { method: "DELETE" });
}

export async function signOutNow(): Promise<void> {
  await request<void>("/api/auth/logout", { method: "POST" });
}

export interface CreatedAccount {
  profile: Profile;
  recoveryCode: string;
}

export async function registerAccount(name: string, email: string): Promise<CreatedAccount> {
  const start = await request<{ options: PublicKeyCredentialCreationOptionsJSON }>(
    "/api/auth/register/options",
    {
      method: "POST",
      body: JSON.stringify({ name, email }),
    },
  );
  const response: RegistrationResponseJSON = await startRegistration({
    optionsJSON: start.options,
  });
  return request<CreatedAccount>("/api/auth/register/verify", {
    method: "POST",
    body: JSON.stringify({ response }),
  });
}

export async function signInWithPasskey(): Promise<Profile> {
  const start = await request<{ options: PublicKeyCredentialRequestOptionsJSON }>(
    "/api/auth/login/options",
    { method: "POST" },
  );
  const response: AuthenticationResponseJSON = await startAuthentication({
    optionsJSON: start.options,
  });
  const result = await request<{ profile: Profile }>("/api/auth/login/verify", {
    method: "POST",
    body: JSON.stringify({ response }),
  });
  return result.profile;
}

export async function signInWithRecovery(code: string): Promise<Profile> {
  const result = await request<{ profile: Profile }>("/api/auth/recovery", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return result.profile;
}

export async function addPasskey(): Promise<void> {
  const start = await request<{ options: PublicKeyCredentialCreationOptionsJSON }>(
    "/api/auth/passkey/options",
    { method: "POST" },
  );
  const response: RegistrationResponseJSON = await startRegistration({
    optionsJSON: start.options,
  });
  await request<{ ok: true }>("/api/auth/passkey/verify", {
    method: "POST",
    body: JSON.stringify({ response }),
  });
}

export async function rotateRecoveryKey(): Promise<string> {
  const result = await request<{ recoveryCode: string }>("/api/auth/recovery/rotate", {
    method: "POST",
  });
  return result.recoveryCode;
}
