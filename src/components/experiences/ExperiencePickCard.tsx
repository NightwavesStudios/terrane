import RidgeArt from "../RidgeArt";
import { guideKind } from "../../data/guide";
import type { Pick } from "../../data/features";
import { placeLine } from "../../lib/present";
import { navigate } from "../../lib/router";
import {
  toggleSavedGuide,
  useSavedGuideSlugs,
} from "../../lib/savedGuides";

/**
 * The card a curated Experience beacon opens.
 *
 * One destination, one page. Saving goes to the Experience store, never the
 * place list and never the Collections. The card prints only what the record
 * holds: kind, recorded neighbours and named trails.
 */
export default function ExperiencePickCard({
  pick,
  onClose,
}: {
  pick: Pick;
  onClose: () => void;
}) {
  const savedSlugs = useSavedGuideSlugs();
  const row = pick.experience;
  const slug = pick.slug;
  if (!row || !slug) return null;

  const kind = guideKind(row.kind);
  const saved = savedSlugs.has(slug);
  const where = placeLine(pick.region, pick.country);

  return (
    <aside className="pick pick--experience" aria-live="polite">
      <button className="pick-close" onClick={onClose} aria-label="Close Experience card">
        ×
      </button>
      <div className="pick-art pick-art--experience">
        <RidgeArt hue={pick.hue ?? 206} className="pick-art-svg" />
        <span className="exp-pick-badge mono">{kind.one}</span>
      </div>
      <div className="pick-body">
        <p className="mono pick-eyebrow">Experience · {kind.label}</p>
        <h2>{pick.name}</h2>
        <p className="mono pick-meta">
          {[
            `${row.places} catalogued places nearby`,
            row.trails ? `${row.trails} named trails` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {where ? <p className="mono pick-meta">{where}</p> : null}
        <div className="pick-actions">
          <button
            className={`btn btn-light${saved ? " btn-saved" : ""}`}
            onClick={() => {
              toggleSavedGuide({
                slug,
                name: pick.name,
                kind: row.kind,
                country: pick.country,
                region: pick.region,
              });
            }}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
          <button className="btn btn-light" onClick={() => navigate(`/experiences/${slug}`)}>
            Open Experience →
          </button>
        </div>
      </div>
    </aside>
  );
}
