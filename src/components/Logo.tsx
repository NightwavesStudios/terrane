/**
 * The mark: a diamond with a ridge line inside it.
 *
 * The diamond is the old favicon shape kept as a frame; the ridge is the thing the
 * site is actually about — three summits on a skyline, drawn with the same weight
 * as the frame so the mark reads at 16 px. It inherits `currentColor`, so it takes
 * the mint on the globe header and the same mint on the dark place page.
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`logo ${className}`.trim()}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Terrane"
    >
      <path
        d="M16 3 29 16 16 29 3 16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 20.4 13.2 13.2 16.2 17.2 18.6 13.8 22.8 20.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
