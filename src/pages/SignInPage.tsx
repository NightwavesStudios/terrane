import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useRecord } from "../state/RecordContext";

function safeTarget(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/progress";
}

export default function SignInPage() {
  const { profile, signIn, signOut } = useRecord();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const target = safeTarget(params.get("returnTo"));
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim()) {
      setError("Add a name for the record.");
      return;
    }
    signIn(displayName, email);
    navigate(target, { replace: true });
  }

  if (profile) {
    return (
      <div className="content-page auth-page">
        <PageHeader
          index="05"
          eyebrow="Record"
          title={
            <>
              You are <span className="display-italic">signed in.</span>
            </>
          }
          description={`The record belongs to ${profile.displayName}. This local preview keeps it in this browser.`}
        />
        <div className="auth-card">
          <p className="eyebrow">Local record</p>
          <h2>{profile.displayName}</h2>
          <p>{profile.email || "No email on this local profile"}</p>
          <dl className="auth-facts">
            <div>
              <dt>Units</dt>
              <dd>{profile.units === "imperial" ? "Feet / miles" : "Metres / kilometres"}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>This browser only</dd>
            </div>
          </dl>
          <div className="form-actions">
            <button type="button" className="button button--bright" onClick={() => navigate(target)}>
              Continue
            </button>
            <Link to="/settings" className="button">
              Settings
            </Link>
            <button
              type="button"
              className="button"
              onClick={() => {
                signOut();
                navigate("/");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page auth-page">
      <PageHeader
        index="05"
        eyebrow="Record"
        title={
          <>
            A record that <span className="display-italic">leaves.</span>
          </>
        }
        description="Sign in to start a list, log climbs and keep a private record. Phase A runs locally; no email is sent and no server account is created."
        aside={
          <div className="status-card">
            <span className="status-card__label">Phase A preview</span>
            <strong>Local-first</strong>
            <span>Export works today</span>
          </div>
        }
      />

      <div className="auth-layout">
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Start your record</p>
          <h2>Make the mountains yours.</h2>
          <label className="form-field">
            <span>Name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How the record should address you"
              autoComplete="name"
              required
            />
          </label>
          <label className="form-field">
            <span>Email <em>optional in this preview</em></span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button type="submit" className="button button--bright">
            Continue to the record
          </button>
          <p className="muted-note">
            No password, no verification email and no server request. To test export, open Settings after signing in.
          </p>
        </form>

        <aside className="auth-aside">
          <p className="eyebrow">What is real in Phase A</p>
          <h2>Five lists. One flow.</h2>
          <ol className="auth-list">
            <li>Start a list, or all five.</li>
            <li>Log a climb, or backfill a history.</li>
            <li>See the list progress and export the record.</li>
          </ol>
          <p className="muted-note">
            Production auth, Postgres, Vercel and email are not connected in this workspace. The product plan keeps
            those as dependencies; the local preview does not pretend they exist.
          </p>
          <Link to="/about/data" className="text-link">
            Read about the data <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
