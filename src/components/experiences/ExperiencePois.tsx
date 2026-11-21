import { category } from "../../data/features";
import type { ExperiencePoi } from "../../lib/experiencePois";
import { coordinates, formatKm } from "../../lib/present";

/**
 * Practical places around one Experience.
 *
 * These are not part of the generated record: they are OpenStreetMap cells read
 * at runtime, which is why the section credits OSM, prints the coordinates and
 * says the coverage is uneven. An empty answer is a statement about mapping, not
 * about the ground — and no campsite is ever inferred from the destinations.
 */
export default function ExperiencePois({
  pois,
  status,
}: {
  pois: ExperiencePoi[];
  status: "idle" | "loading" | "ready" | "error";
}) {
  if (status === "loading") {
    return (
      <p className="mono exp-note">
        Reading the OpenStreetMap cells around these places…
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="mono exp-note">
        The practical places could not be loaded. The Experience above does not
        depend on them.
      </p>
    );
  }

  return (
    <>
      {pois.length === 0 ? (
        <p className="exp-poi-empty">
          The cells around these places record no named campsites, huts,
          trailheads or viewpoints.
        </p>
      ) : (
        <ul className="exp-pois">
          {pois.map((poi) => (
            <li key={`${poi.cat}-${poi.name}-${poi.lat}-${poi.lon}`} className="exp-poi">
              <span className="exp-poi-name">{poi.name}</span>
              <span className="mono exp-poi-meta">
                {category(poi.cat).one} · {formatKm(poi.km)} from the centre ·{" "}
                {coordinates(poi.lat, poi.lon)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mono exp-note">
        Practical places: OpenStreetMap (ODbL). Coverage varies by country; a blank
        valley means nobody mapped it, not that there is nowhere to stay.
      </p>
    </>
  );
}
