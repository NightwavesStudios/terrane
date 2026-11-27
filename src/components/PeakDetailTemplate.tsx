import { formatElevation } from "../lib/format";
import type { Peak } from "../types/geography";
import Icon from "./Icon";

interface Props {
  peak?: Peak;
}

export default function PeakDetailTemplate({ peak }: Props) {
  const fields = [
    { label: "Elevation", value: formatElevation(peak?.elevationM) },
    { label: "Prominence", value: formatElevation(peak?.prominenceM) },
    { label: "Location", value: peak?.location ?? "—" },
    { label: "Mountain range", value: peak?.range ?? "—" },
  ];

  return (
    <article className="peak-detail">
      <header className="peak-detail__header">
        <div>
          <p className="eyebrow">Peaks / Detail template</p>
          <h1>{peak?.name ?? "Peak detail"}</h1>
          <p className="peak-detail__lede">
            {peak?.description ??
              "The reusable profile for a summit: its geography, its story and the actions that will connect it to your climbing record."}
          </p>
        </div>
        <span className="status-pill">{peak ? "Peak record" : "Awaiting peak data"}</span>
      </header>

      <div className="peak-detail__layout">
        <div className="peak-detail__main">
          <section className="detail-section">
            <div className="section-heading">
              <span>01</span>
              <h2>Profile</h2>
            </div>
            <dl className="detail-fields">
              {fields.map((field) => (
                <div className="detail-field" key={field.label}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="detail-section">
            <div className="section-heading">
              <span>02</span>
              <h2>About this peak</h2>
            </div>
            <p className="detail-copy">
              {peak?.description ??
                "A sourced description will live here. No peak narrative or mountain record is loaded in Phase 01."}
            </p>
          </section>
        </div>

        <aside className="peak-detail__aside">
          <div className="detail-map" aria-label="Future map location for this peak">
            <span className="detail-map__grid" aria-hidden="true" />
            <span className="detail-map__ring detail-map__ring--one" aria-hidden="true" />
            <span className="detail-map__ring detail-map__ring--two" aria-hidden="true" />
            <span className="detail-map__pin">
              <Icon name="pin" size={24} />
            </span>
            <span className="detail-map__label">Map location will appear here</span>
          </div>

          <div className="detail-actions">
            <button type="button" disabled>
              <Icon name="check" size={17} /> Mark as climbed
            </button>
            <button type="button" disabled>
              <Icon name="plus" size={17} /> Save peak
            </button>
            <button type="button" disabled>
              <Icon name="list" size={17} /> Add to list
            </button>
          </div>
          <p className="muted-note">Actions activate with accounts and a connected peak index.</p>
        </aside>
      </div>
    </article>
  );
}
