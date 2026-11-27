import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
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
    updateProfile,
    setUnits,
    signOut,
    deleteRecord,
  } = useRecord();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [units, setLocalUnits] = useState(profile?.units ?? "imperial");
  const [message, setMessage] = useState("");

  if (!hydrated) return <div className="content-page" aria-busy="true" />;
  if (!profile) {
    return <Navigate to={`/signin?returnTo=${encodeURIComponent("/settings")}`} replace />;
  }

  const record = { profile, startedLists, listStarts, badges, listCompletions, trips };

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile(name, email, units);
    setUnits(units);
    setMessage("Profile saved locally.");
  }

  function removeRecord() {
    if (!window.confirm("Delete the profile, started lists and every trip in this browser?")) return;
    deleteRecord();
    navigate("/");
  }

  function leave() {
    signOut();
    navigate("/");
  }

  return (
    <div className="content-page">
      <PageHeader
        index="06"
        eyebrow="Settings"
        title={
          <>
            The record, <span className="display-italic">yours.</span>
          </>
        }
        description="Edit the profile, choose units, export the record or remove the local copy. Settings do not change the publisher's list."
        aside={
          <div className="status-card">
            <span className="status-card__label">Storage</span>
            <strong>Local browser</strong>
            <span>{trips.length} trips · {startedLists.length} started lists</span>
          </div>
        }
      />

      <div className="settings-layout">
        <form className="settings-card" onSubmit={save}>
          <p className="eyebrow">Profile</p>
          <h2>How the record reads.</h2>
          <label className="form-field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Optional in this preview"
            />
          </label>
          <label className="form-field">
            <span>Units</span>
            <select value={units} onChange={(event) => setLocalUnits(event.target.value as typeof units)}>
              <option value="imperial">Feet / miles</option>
              <option value="metric">Metres / kilometres</option>
            </select>
          </label>
          {message ? <p className="form-success" role="status">{message}</p> : null}
          <div className="form-actions">
            <button type="submit" className="button button--bright">Save profile</button>
            <Link to="/progress" className="button">Back to progress</Link>
          </div>
        </form>

        <aside className="settings-aside">
          <section className="settings-block">
            <p className="eyebrow">Portable record</p>
            <h2>Take it with you.</h2>
            <p>Export every trip, including source, precision and peak outcome. No lock-in.</p>
            <div className="form-actions">
              <Link to="/import" className="button">Import CSV</Link>
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
            <p>Signing out clears the local record in this preview. Delete removes the local copy immediately.</p>
            <div className="form-actions">
              <button type="button" className="button" onClick={leave}>
                Sign out
              </button>
              <button type="button" className="button button--danger" onClick={removeRecord}>
                Delete local record
              </button>
            </div>
          </section>

          <p className="muted-note">
            <Link to="/about/data" className="text-link">Data and sources</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
