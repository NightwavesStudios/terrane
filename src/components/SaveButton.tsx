/**
 * The one save control.
 *
 * Place and Experience pages carried two of these with two labels ("Save" in the
 * hero, "Save this place" in the aside), which read as two different actions on
 * the same record. The hero owns the save; the aside keeps the secondary work.
 */
export default function SaveButton({
  saved,
  onToggle,
  label = "Save",
  variant = "block",
}: {
  saved: boolean;
  onToggle: () => void;
  label?: string;
  /** `float` sits on a hero photograph, `block` fills an aside, `inline` a card. */
  variant?: "float" | "block" | "inline";
}) {
  const cls =
    variant === "float"
      ? `place-save${saved ? " on" : ""}`
      : variant === "inline"
        ? `exp-card-save${saved ? " on" : ""}`
        : `btn btn-light btn-full save-btn${saved ? " btn-saved" : ""}`;

  return (
    <button
      className={cls}
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from Saved` : `Save ${label}`}
    >
      {saved ? "Saved ✓" : label}
    </button>
  );
}
