import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "arrow"
  | "check"
  | "compass"
  | "list"
  | "peak"
  | "pin"
  | "plus"
  | "progress"
  | "search"
  | "target"
  | "journal"
  | "volcano"
  | "trek"
  | "canyon"
  | "desert"
  | "lake"
  | "glacier"
  | "coast"
  | "island";

const paths: Record<IconName, ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.8 9.2-1.7 4.1-4.1 1.7 1.7-4.1 4.1-1.7Z" />
    </>
  ),
  list: (
    <>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" strokeWidth="2.4" />
    </>
  ),
  peak: (
    <>
      <path d="m3 19 5.6-12 3.1 6.2 1.9-3.1L21 19H3Z" />
      <path d="m8.6 7 1.8 4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  progress: (
    <>
      <path d="M5 19V9M12 19V5M19 19v-7" />
      <path d="M3 19h18" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22" />
    </>
  ),
  journal: (
    <>
      <path d="M6.5 3.5h11.5a1 1 0 0 1 1 1v16H7.5a2 2 0 0 1-2-2v-14a1 1 0 0 1 1-1Z" />
      <path d="M8 3.5v17" />
      <path d="M11 8.5h5M11 12.5h5" />
    </>
  ),
  volcano: (
    <>
      <path d="M3 19h18" />
      <path d="m6.5 19 3-8h5l3 8" />
      <path d="M12 11V8" />
      <path d="m9.7 6.6 2.3-2.4 2.3 2.4" />
    </>
  ),
  trek: (
    <>
      <path d="M4 19c4.5-8 11-2.5 16-10" />
      <circle cx="4" cy="19" r="1.5" />
      <circle cx="20" cy="9" r="1.5" />
      <path d="M9 15.5c1.5-.2 3-1 4-2.2" />
    </>
  ),
  canyon: (
    <>
      <path d="M2 8h5.5l2 3.5h7L19 8h3" />
      <path d="M2 17h5l2-3h7l2 3h3" />
      <path d="M9.5 8v9M16.5 8v9" />
    </>
  ),
  desert: (
    <>
      <path d="M2 18c3.8 0 4-6 9.2-6s5.2 6 10.8 6" />
      <circle cx="17" cy="6" r="2.6" />
      <path d="M2 21h20" />
    </>
  ),
  lake: (
    <>
      <path d="M3 8.5c3 0 3.2 2 6.2 2s3.4-2 6.4-2 3.2 2 5.4 2" />
      <path d="M3 14c3 0 3.2 2 6.2 2s3.4-2 6.4-2 3.2 2 5.4 2" />
      <path d="M3 19.5h18" />
    </>
  ),
  glacier: (
    <>
      <path d="m4 16 4.5-9 3 4.4 2.2-2.6L20 16" />
      <path d="M2 19.5h20" />
      <path d="M9 16v3.5M15.5 16v3.5" />
    </>
  ),
  coast: (
    <>
      <path d="M3 9c3 0 3.2 2 6.2 2s3.4-2 6.4-2 3.2 2 5.4 2" />
      <path d="M3 15c3 0 3.2 2 6.2 2s3.4-2 6.4-2 3.2 2 5.4 2" />
    </>
  ),
  island: (
    <>
      <path d="M2.5 15.5c3-4.5 6.5-5.5 9-3.5 2-4 6.5-4 10 0" />
      <path d="M2 19.5h20" />
      <path d="M11.5 12V7" />
      <path d="M11.5 7.5c1.6-2 3.6-2 4.5-1.2M11.5 7.5C10 5.5 8 5.5 7 6.3" />
    </>
  ),
};

interface Props extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export default function Icon({ name, size = 18, ...props }: Props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
