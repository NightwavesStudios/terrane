import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import {
  ApiError,
  registerAccount,
  signInWithPasskey,
  signInWithRecovery,
  type CreatedAccount,
} from "../lib/api";
import { useRecord } from "../state/RecordContext";

function safeTarget(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/progress";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "The passkey prompt was cancelled or timed out. Try again when you are ready.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "The passkey step did not finish. Try again.";
}

export default function SignInPage() {
  const { profile, signOut, localRecord, syncState, syncError } = useRecord();
  const [params] = useSearchParams();
  const target = safeTarget(params.get("returnTo"));
  const localTrips = localRecord?.trips.length ?? 0;
  const supportsPasskeys =
    typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"create" | "passkey" | "recovery" | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);
  const [recovery, setRecovery] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supportsPasskeys) {
      setError("This browser does not support passkeys. Use a recovery key or a newer browser.");
      return;
    }
    setBusy("create");
    try {
      const result = await registerAccount(name, email);
      setCreated(result);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(null);
    }
  }

  async function usePasskey() {
    setError("");
    if (!supportsPasskeys) {
      setError("This browser does not support passkeys. Use a recovery key instead.");
      return;
    }
    setBusy("passkey");
    try {
      await signInWithPasskey();
      window.location.assign(target);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(null);
    }
  }

  async function useRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy("recovery");
    try {
      await signInWithRecovery(recovery);
      window.location.assign(target);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(null);
    }
  }

  async function copyRecovery() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.recoveryCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (profile) {
    return (
      <div className="content-page auth-page">
        <Link to="/" className="back-link">
          <Icon name="arrow" size={15} /> Back to explore
        </Link>
        <div className="auth-signed-head">
          <p className="eyebrow">Your account</p>
          <h1>
            You&apos;re <span className="display-italic">in.</span>
          </h1>
          <p>Your climbs, lists and dates are saved to this account.</p>
        </div>

        <div className="record-card">
          <div className="record-identity">
            <span className="record-identity__avatar">{initials(profile.displayName)}</span>
            <div>
              <strong>{profile.displayName}</strong>
              <span>{profile.email || "Passkey account"}</span>
            </div>
          </div>
          <dl className="record-facts">
            <div>
              <dt>Units</dt>
              <dd>{profile.units === "imperial" ? "Feet / miles" : "Metres / kilometres"}</dd>
            </div>
            <div>
              <dt>Sign-in</dt>
              <dd>Passkey</dd>
            </div>
            <div>
              <dt>Sync</dt>
              <dd>
                {syncState === "saving"
                  ? "Saving…"
                  : syncState === "error"
                    ? "Needs attention"
                    : "Up to date"}
              </dd>
            </div>
          </dl>
          {syncError ? (
            <p className="form-error" role="alert">
              {syncError}
            </p>
          ) : null}
          {localTrips ? (
            <p className="muted-note">
              This browser also has {localTrips} {localTrips === 1 ? "climb" : "climbs"} from
              before accounts. Import them from Settings.
            </p>
          ) : null}
          <div className="form-actions">
            <button
              type="button"
              className="button button--bright"
              onClick={() => window.location.assign(target)}
            >
              Open my record
            </button>
            <Link to="/settings" className="button">
              Settings
            </Link>
            <button type="button" className="button button--quiet" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page auth-page">
      <Link to="/" className="back-link">
        <Icon name="arrow" size={15} /> Back to explore
      </Link>

      <div className="auth-layout auth-layout--clean">
        <section className="auth-intro">
          <p className="eyebrow">A private record</p>
          <h1>
            Keep your <span className="display-italic">climbs.</span>
          </h1>
          <p>
            Create a passkey account to keep every summit, date and list in one private record
            that follows you to another device.
          </p>
          <ul className="auth-benefits">
            <li>
              <Icon name="check" size={15} /> No password to remember or leak
            </li>
            <li>
              <Icon name="check" size={15} /> Track all five lists in one place
            </li>
            <li>
              <Icon name="check" size={15} /> Export or delete the whole record whenever you want
            </li>
          </ul>
        </section>

        <div className="auth-card">
          {created ? (
            <>
              <p className="eyebrow">One last step</p>
              <h2>Save your recovery key.</h2>
              <p className="auth-lede">
                This key is the only way back into {created.profile.displayName}&apos;s record if
                you lose this device. It is shown once.
              </p>
              <code className="recovery-code" data-testid="recovery-code">
                {created.recoveryCode}
              </code>
              <div className="form-actions">
                <button type="button" className="button" onClick={() => void copyRecovery()}>
                  {copied ? "Copied" : "Copy recovery key"}
                </button>
                <button
                  type="button"
                  className="button button--bright"
                  onClick={() => window.location.assign(target)}
                >
                  I saved it — open my record
                </button>
              </div>
              <p className="muted-note">
                You can create a new recovery key later in Settings, but only while signed in.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">Create an account</p>
              <h2>Start with a passkey.</h2>
              <p className="auth-lede">
                Your device asks for Face ID, Touch ID, Windows Hello or a security key. Terrane
                never sees a password.
              </p>
              {!supportsPasskeys ? (
                <p className="form-error" role="alert">
                  This browser does not support passkeys. Sign in with a recovery key below, or
                  open Terrane in a newer browser.
                </p>
              ) : null}
              <form className="auth-form" onSubmit={create}>
                <label className="form-field">
                  <span>Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Email (optional)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    maxLength={254}
                    placeholder="Only used to label your passkey"
                  />
                </label>
                <button
                  type="submit"
                  className="button button--bright button--full"
                  disabled={busy !== null}
                >
                  {busy === "create" ? "Waiting for your device…" : "Create account with a passkey"}
                </button>
              </form>

              <p className="auth-divider">
                <span>or</span>
              </p>

              <button
                type="button"
                className="button button--full"
                onClick={() => void usePasskey()}
                disabled={busy !== null}
              >
                {busy === "passkey" ? "Waiting for your device…" : "Sign in with a passkey"}
              </button>

              <details className="auth-recovery">
                <summary>Use a recovery key</summary>
                <form onSubmit={useRecovery}>
                  <label className="form-field">
                    <span>Recovery key</span>
                    <input
                      value={recovery}
                      onChange={(event) => setRecovery(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Paste the key saved when you created the account"
                    />
                  </label>
                  <button
                    type="submit"
                    className="button button--bright button--full"
                    disabled={busy !== null || recovery.trim().length < 20}
                  >
                    {busy === "recovery" ? "Checking…" : "Sign in with recovery key"}
                  </button>
                </form>
              </details>

              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}

              <Link to="/" className="button button--quiet button--full">
                Browse without a record
              </Link>
              {localTrips ? (
                <p className="muted-note">
                  This browser has {localTrips} earlier {localTrips === 1 ? "climb" : "climbs"}.
                  After signing in, import them from Settings.
                </p>
              ) : (
                <p className="muted-note">
                  The record is private by default. Account data is stored in Terrane&apos;s D1
                  database and never mixed into the public peak catalogue.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
