import { navigate } from "../lib/router";

/**
 * The one back link. Every reading page returns to the surface it came from, and
 * every one of them used to spell that differently with its own inline markup.
 */
export default function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <button className="back" onClick={() => navigate(to)}>
      <span aria-hidden="true">←</span> {label}
    </button>
  );
}
