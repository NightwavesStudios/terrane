import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  ApiError,
  registerAccount,
  signInWithPasskey,
  signInWithRecovery,
  type CreatedAccount,
} from "../lib/api";
import { useRecord } from "../state/RecordContext";

function safeTarget(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/signin")) {
    return value;
  }
  return "/progress";
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "The passkey prompt was cancelled or timed out.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "The passkey step did not finish. Try again.";
}

export default function SignInPage() {
  const { profile, hydrated, localRecord } = useRecord();
  const [params] = useSearchParams();
  const target = safeTarget(params.get("returnTo"));
  const localTrips = localRecord?.trips.length ?? 0;
  const supportsPasskeys =
    typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";

  const [mode, setMode] = useState<"create" | "signin">(() =>
    params.get("mode") === "signin" || params.get("returnTo") ? "signin" : "create",
  );
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
      setError("Passkeys are not available in this browser.");
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
      setError("Passkeys are not available in this browser. Use a recovery key instead.");
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

  function switchMode(next: "create" | "signin") {
    setMode(next);
    setError("");
  }

  if (!hydrated && typeof window !== "undefined") {
    return <div className="content-page auth-page auth-page--panel" aria-busy="true" />;
  }

  if (profile && !created) {
    return <Navigate to={target} replace />;
  }

  const title = target.startsWith("/log") ? (
    <>
      Save this <span className="display-italic">climb.</span>
    </>
  ) : target.startsWith("/lists") ? (
    <>
      Start this <span className="display-italic">list.</span>
    </>
  ) : target.startsWith("/peaks") ? (
    <>
      Log this <span className="display-italic">peak.</span>
    </>
  ) : (
    <>
      Your <span className="display-italic">record.</span>
    </>
  );

  return (
    <div className="content-page auth-page auth-page--panel">
      <section className="auth-panel">
        <header className="auth-panel__head">
          <p className="eyebrow">Passkey account</p>
          <h1>{title}</h1>
        </header>

        {created ? (
          <>
            <p className="eyebrow">Recovery key</p>
            <h2>Save this key.</h2>
            <p className="auth-lede">
              Shown once. It is the only way back if you lose this device.
            </p>
            <code className="recovery-code" data-testid="recovery-code">
              {created.recoveryCode}
            </code>
            <div className="form-actions">
              <button type="button" className="button" onClick={() => void copyRecovery()}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="button button--bright"
                onClick={() => window.location.assign(target)}
              >
                I saved it
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="Account">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "create"}
                className={mode === "create" ? "is-active" : ""}
                onClick={() => switchMode("create")}
              >
                New account
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={mode === "signin" ? "is-active" : ""}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
            </div>

            <div className="auth-panel__body" role="tabpanel">
              {mode === "create" ? (
                <>
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
                      />
                    </label>
                    <button
                      type="submit"
                      className="button button--bright button--full"
                      disabled={busy !== null}
                    >
                      {busy === "create" ? "Waiting for your device…" : "Create account"}
                    </button>
                  </form>
                  {localTrips ? (
                    <p className="auth-note">
                      {localTrips} {localTrips === 1 ? "climb is" : "climbs are"} saved in this
                      browser. Import after signing in.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="button button--bright button--full auth-passkey"
                    onClick={() => void usePasskey()}
                    disabled={busy !== null}
                  >
                    {busy === "passkey" ? "Waiting for your device…" : "Continue with a passkey"}
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
                          placeholder="Paste your key"
                        />
                      </label>
                      <button
                        type="submit"
                        className="button button--full"
                        disabled={busy !== null || recovery.trim().length < 20}
                      >
                        {busy === "recovery" ? "Checking…" : "Continue with key"}
                      </button>
                    </form>
                  </details>
                  {localTrips ? (
                    <p className="auth-note">
                      {localTrips} {localTrips === 1 ? "climb is" : "climbs are"} saved in this
                      browser. Import after signing in.
                    </p>
                  ) : null}
                </>
              )}

              {!supportsPasskeys ? (
                <p className="form-error" role="alert">
                  This browser does not support passkeys.
                </p>
              ) : null}
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <p className="auth-browse">
              <Link to="/">Browse without an account</Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
