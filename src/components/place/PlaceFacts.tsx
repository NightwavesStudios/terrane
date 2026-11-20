import type { ReactNode } from "react";

export type Fact = { k: string; v: ReactNode; mono?: boolean };

/** The fact strip under the hero: the same order on every destination. */
export default function PlaceFacts({ facts }: { facts: Fact[] }) {
  return (
    <div className="stat-grid">
      {facts.map((fact) => (
        <div className="stat" key={fact.k}>
          <span className="mono k">{fact.k}</span>
          <span className={`v${fact.mono ? " coord-v" : ""}`}>{fact.v}</span>
        </div>
      ))}
    </div>
  );
}
