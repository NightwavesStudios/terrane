import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { addPasskey, rotateRecoveryKey } from "../lib/api";
import { exportCsv, exportJson } from "../lib/export";
import { useRecord } from "../state/RecordContext";

export default function SettingsPage() {
  const {
    profile,
    startedLists,
    listStarts,
    badges,
    listCompletions,
    trips,
    hydrated,
    syncState,
    syncError,
    localRecord,
    updateProfile,
    signOut,
    deleteRecord,
    importLocalRecord,
    retrySync,
  } = useRecord();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [units, setLocalUnits] = useState(profile?.units ?? "imperial");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [securityBusy, setSecurityBusy] = useState<"passkey" | "recovery" | null>(null);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [newRecovery, setNewRecovery] = useState("");

  useEffect(() => {
    if (!profile) return;
    setName(profile.displayName);
    setLocalUnits(profile.units);
  }, [profile]);

  if (!hydrated) return <div className="content-page" aria-busy="true" />;
  if (!profile) {
    return <Navigate to={`/signin?returnTo=${encodeURIComponent("/settings")}`} replace />;
  }

  const record = { profile, startedLists, listStarts, badges, listCompletions, trips };
  const localTrips = localRecord?.trips.length ?? 0;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await updateProfile(name, units);
      setMessage("Profile saved to your account.");
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "The profile could not be saved.");
    }
  }

  function removeRecord() {
    if (
      !window.confirm(
        "Delete this account, including every trip, started list, passkey and recovery key? This cannot be undone.",
      )
    ) {
      return;
    }
    void deleteRecord();
  }

  async function addAnotherPasskey() {
    setSecurityError("");
    setSecurityMessage("");
    setSecurityBusy("passkey");
    try {
      await addPasskey();
      setSecurityMessage("This device can now sign in with a passkey.");
    } catch (caught) {
      setSecurityError(
        caught instanceof Error ? caught.message : "The passkey was not added.",
      );
    } finally {
      setSecurityBusy(null);
    }
  }

  async function rotateRecovery() {
    setSecurityError("");
    setSecurityMessage("");
    setSecurityBusy("recovery");
    try {
      const code = await rotateRecoveryKey();
      setNewRecovery(code);
      setSecurityMessage("A new recovery key replaced the old one.");
    } catch (caught) {
      setSecurityError(
        caught instanceof Error ? caught.message : "The recovery key was not replaced.",
      );
    } finally {
      setSecurityBusy(null);
    }
  }

  async function importLocal() {
    setError("");
    setImporting(true);
    try {
      await importLocalRecord();
      setMessage("The climbs from this browser are now in your account.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The local record could not be imported.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="content-page">
      <PageHeader
        eyebrow="Settings"
        title={
          <>
            Record <span className="display-italic">settings.</span>
          </>
        }
        description="Profile, sync, export and the account copy."
        aside={
          <div className="status-card">
            <span className="status-card__label">Storage</span>
            <strong>Cloud account</strong>
            <span>
              {trips.length} trips · {startedLists.length} started lists
            </span>
          </div>
        }
      />

      <div className="settings-layout">
        <form className="settings-card" onSubmit={save}>
          <p className="eyebrow">Profile</p>
          <h2>How the record reads.</h2>
          <label className="form-field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setMessage("");
                setError("");
              }}
              required
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input value={profile.email || "No email on this account"} readOnly disabled />
          </label>
          <label className="form-field">
            <span>Units</span>
            <select
              value={units}
              onChange={(event) => setLocalUnits(event.target.value as typeof units)}
            >
              <option value="imperial">Feet / miles</option>
              <option value="metric">Metres / kilometres</option>
            </select>
          </label>
          {message ? (
            <p className="form-success" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="form-actions">
            <button type="submit" className="button button--bright">
              Save profile
            </button>
            <Link to="/progress" className="button">
              Back to progress
            </Link>
          </div>
        </form>

        <aside className="settings-aside">
          <section className="settings-block">
            <div className="settings-block__head">
              <div>
                <p className="eyebrow">Account</p>
                <h2>Synced to this account.</h2>
              </div>
              <span className={`sync-dot sync-dot--${syncState}`} aria-hidden="true" />
            </div>
            <p>
              {syncState === "saving"
                ? "Saving the latest change…"
                : syncState === "error"
                  ? "A change has not reached the server yet."
                  : "Every trip and list change is saved to your account."}
            </p>
            {syncError ? (
              <p className="form-error" role="alert">
                {syncError}
              </p>
            ) : null}
            {syncState === "error" ? (
              <div className="form-actions">
                <button type="button" className="button" onClick={retrySync}>
                  Retry sync
                </button>
              </div>
            ) : null}
            {localTrips ? (
              <div className="local-import">
                <p className="eyebrow">From this browser</p>
                <h3>
                  {localTrips} {localTrips === 1 ? "climb" : "climbs"} from before accounts.
                </h3>
                <p>Add them to this account. Nothing is overwritten.</p>
                <button
                  type="button"
                  className="button button--bright"
                  onClick={() => void importLocal()}
                  disabled={importing}
                >
                  {importing ? "Importing…" : "Import local climbs"}
                </button>
              </div>
            ) : null}
          </section>

          <section className="settings-block">
            <p className="eyebrow">Security</p>
            <h2>Passkeys, not passwords.</h2>
            <p>
              Sign in with Face ID, Touch ID, Windows Hello or a security key. Add another device
              here, or replace the recovery key if it may have been seen.
            </p>
            {securityMessage ? (
              <p className="form-success" role="status">
                {securityMessage}
              </p>
            ) : null}
            {securityError ? (
              <p className="form-error" role="alert">
                {securityError}
              </p>
            ) : null}
            {newRecovery ? (
              <div className="recovery-panel">
                <span className="eyebrow">New recovery key</span>
                <code className="recovery-code">{newRecovery}</code>
                <small>Shown once. Store it somewhere safe.</small>
              </div>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                className="button button--bright"
                onClick={() => void addAnotherPasskey()}
                disabled={securityBusy !== null}
              >
                {securityBusy === "passkey" ? "Waiting for your device…" : "Add a passkey"}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => void rotateRecovery()}
                disabled={securityBusy !== null}
              >
                {securityBusy === "recovery" ? "Creating…" : "New recovery key"}
              </button>
            </div>
          </section>

          <section className="settings-block">
            <p className="eyebrow">Portable record</p>
            <h2>Take it with you.</h2>
            <p>Export every trip, including source, precision and peak outcome. No lock-in.</p>
            <div className="form-actions">
              <Link to="/import" className="button">
                Import CSV
              </Link>
              <button type="button" className="button" onClick={() => exportJson(record)}>
                Export JSON
              </button>
              <button type="button" className="button" onClick={() => exportCsv(record)}>
                Export CSV
              </button>
            </div>
          </section>

          <section className="settings-block settings-block--danger">
            <p className="eyebrow">Leaving / erasing</p>
            <h2>No hidden retention.</h2>
            <p>Signing out ends the browser session. Deleting removes the account, passkeys and recovery key.</p>
            <div className="form-actions">
              <button type="button" className="button" onClick={signOut}>
                Sign out
              </button>
              <button type="button" className="button button--danger" onClick={removeRecord}>
                Delete account
              </button>
            </div>
          </section>

          <p className="muted-note">
            <Link to="/about/data" className="text-link">
              Data and sources
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
