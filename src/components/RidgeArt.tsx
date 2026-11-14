import { useId } from "react";

/**
 * Generated landscape art. No photography in v1 — every place gets a
 * deterministic dusk ridge built from its hue instead of a stock photo.
 */
export default function RidgeArt({
  hue,
  className = "",
}: {
  hue: number;
  className?: string;
}) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      className={className}
      viewBox="0 0 400 220"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 52% 22%)`} />
          <stop offset="0.55" stopColor={`hsl(${hue + 14} 46% 12%)`} />
          <stop offset="1" stopColor={`hsl(${hue + 26} 40% 6%)`} />
        </linearGradient>
        <linearGradient id={`far${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue + 8} 32% 14%)`} />
          <stop offset="1" stopColor={`hsl(${hue + 8} 30% 8%)`} />
        </linearGradient>
        <linearGradient id={`near${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue + 4} 26% 7%)`} />
          <stop offset="1" stopColor="#03050a" />
        </linearGradient>
        <radialGradient id={`glow${id}`} cx="0.63" cy="0.3" r="0.55">
          <stop offset="0" stopColor={`hsl(${hue + 45} 78% 72%)`} stopOpacity="0.4" />
          <stop offset="1" stopColor={`hsl(${hue + 45} 78% 72%)`} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="220" fill={`url(#sky${id})`} />
      <rect width="400" height="220" fill={`url(#glow${id})`} />

      <path
        d="M0 152 L38 122 L64 138 L94 104 L126 134 L158 112 L192 142 L224 116 L258 140 L292 118 L326 142 L362 124 L400 144 L400 220 L0 220 Z"
        fill={`url(#far${id})`}
        opacity="0.9"
      />
      <path d="M94 104 L106 121 L82 122 Z" fill="#e9f1f6" opacity="0.5" />
      <path d="M224 116 L236 132 L212 133 Z" fill="#e9f1f6" opacity="0.4" />

      <path
        d="M0 184 L44 158 L82 176 L124 146 L166 178 L210 150 L252 180 L296 158 L340 182 L376 166 L400 178 L400 220 L0 220 Z"
        fill={`url(#near${id})`}
      />
      <rect y="196" width="400" height="24" fill="#02040a" opacity="0.55" />
    </svg>
  );
}
