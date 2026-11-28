import { Link } from "react-router-dom";
import { useRecord } from "../state/RecordContext";

export default function SyncBanner() {
  const { mode, syncState, syncError, retrySync, signOut } = useRecord();
  if (mode !== "account" || syncState !== "error" || !syncError) return null;

  const expired = syncError.includes("session expired");

  return (
    <div className="sync-banner" role="alert">
      <span>{syncError}</span>
      <div className="sync-banner__actions">
        {expired ? (
          <Link to="/signin?returnTo=%2Fprogress" className="text-button">
            Sign in
          </Link>
        ) : (
          <button type="button" className="text-button" onClick={retrySync}>
            Retry
          </button>
        )}
        <button type="button" className="text-button" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
