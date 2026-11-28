import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
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
        <Link to="/" className="back-link">
          <Icon name="arrow" size={15} /> Back to explore
        </Link>
        <div className="auth-signed-head">
          <p className="eyebrow">Your record</p>
          <h1>
            You&apos;re <span className="display-italic">in.</span>
          </h1>
          <p>The climbs, lists and dates in this record are saved on this device.</p>
        </div>

        <div className="record-card">
          <div className="record-identity">
            <span className="record-identity__avatar">{initials(profile.displayName)}</span>
            <div>
              <strong>{profile.displayName}</strong>
              <span>{profile.email || "No email added"}</span>
            </div>
          </div>
          <dl className="record-facts">
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
            <Link to={target} className="button button--bright">
              Open my record
            </Link>
            <Link to="/settings" className="button">
              Settings
            </Link>
            <button
              type="button"
              className="button button--quiet"
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
            Start a record for the peaks you have climbed and the lists you are working through. No
            password, no verification email, no server account.
          </p>
          <ul className="auth-benefits">
            <li>
              <Icon name="check" size={15} /> Track all five lists in one place
            </li>
            <li>
              <Icon name="check" size={15} /> Add past climbs with the detail you know
            </li>
            <li>
              <Icon name="check" size={15} /> Export or delete it whenever you want
            </li>
          </ul>
        </section>

        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Start here</p>
          <h2>Make the record yours.</h2>
          <label className="form-field">
            <span>Name</span>
            <input
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError("");
              }}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </label>
          <label className="form-field">
            <span>
              Email <em>optional</em>
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="button button--bright button--full">
            Create my record
          </button>
          <Link to="/" className="button button--quiet button--full">
            Browse without a record
          </Link>
          <p className="muted-note">
            Saved only in this browser. Export or remove it from Settings.
          </p>
        </form>
      </div>
    </div>
  );
}
