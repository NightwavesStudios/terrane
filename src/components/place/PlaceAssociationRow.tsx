import { bySlug } from "../../data/places";
import type { PlaceAssociation } from "../../lib/placeDetails";
import { formatKm } from "../../lib/present";
import { navigate } from "../../lib/router";

/**
 * A range or protected area. A local page wins, then the Wikipedia article, then
 * plain text: a name from Wikidata is still useful without either.
 */
export default function PlaceAssociationRow({
  assoc,
  label,
}: {
  assoc: PlaceAssociation;
  label: string;
}) {
  const local = assoc.slug ? bySlug.get(assoc.slug) : undefined;
  const distance = assoc.km != null ? formatKm(assoc.km) : "";

  if (local) {
    return (
      <li>
        <button className="around-row" onClick={() => navigate(`/place/${local.slug}`)}>
          <span className="around-name">{assoc.name}</span>
          <span className="around-type mono">{label}</span>
          <span className="around-km mono">{distance || "→"}</span>
        </button>
      </li>
    );
  }

  if (assoc.wiki) {
    return (
      <li>
        <a
          className="around-row around-row--static"
          href={assoc.wiki}
          target="_blank"
          rel="noreferrer"
        >
          <span className="around-name">{assoc.name}</span>
          <span className="around-type mono">{label}</span>
          <span className="around-km mono">{distance || "Wiki →"}</span>
        </a>
      </li>
    );
  }

  return (
    <li>
      <div className="around-row around-row--static">
        <span className="around-name">{assoc.name}</span>
        <span className="around-type mono">{label}</span>
        <span className="around-km mono">{distance}</span>
      </div>
    </li>
  );
}
