import PickSheet from "../PickSheet";
import RidgeArt from "../RidgeArt";
import { guideKind } from "../../data/guide";
import type { Pick } from "../../data/features";
import { placeLine } from "../../lib/present";
import { navigate } from "../../lib/router";
import LogActions from "../LogActions";
import { targetForPick } from "../../lib/logTargets";

/**
 * The card a curated Experience beacon opens.
 *
 * One destination, one page. Want and bagged go to the same local log as every
 * other point. The card prints only what the record holds: kind, recorded
 * neighbours and named trails.
 */
export default function ExperiencePickCard({
  pick,
  onClose,
}: {
  pick: Pick;
  onClose: () => void;
}) {
  const row = pick.experience;
  const slug = pick.slug;
  if (!row || !slug) return null;

  const kind = guideKind(row.kind);
  const where = placeLine(pick.region, pick.country);
  const target = targetForPick(pick);

  return (
    <PickSheet className="pick pick--experience" label={pick.name} onClose={onClose}>
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
        <LogActions target={target} />
        <div className="pick-actions">
          <button className="btn btn-light" onClick={() => navigate(`/experiences/${slug}`)}>
            Read the full place →
          </button>
        </div>
      </div>
    </PickSheet>
  );
}
