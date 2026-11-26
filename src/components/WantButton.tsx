import { toggleWant, useLogEntry, type LogEntry } from "../lib/log";
import type { LogTarget } from "../lib/logTargets";

/** The single want control used on the two detail heroes. */
export default function WantButton({ target }: { target: LogTarget }) {
  const entry = useLogEntry(target.key);
  const done = entry?.state === "done";
  const want = entry?.state === "want";
  const cls = `place-want${want || done ? " on" : ""}`;

  return (
    <button
      className={cls}
      onClick={() =>
        toggleWant({ ...target, state: "want", at: Date.now() } satisfies LogEntry)
      }
      aria-pressed={want || done}
      aria-label={
        done
          ? `${target.name} is bagged`
          : want
            ? `Remove ${target.name} from your list`
            : `Want to go to ${target.name}`
      }
      disabled={done}
    >
      {done ? "Bagged ✓" : want ? "On your list ✓" : "Want to go"}
    </button>
  );
}
