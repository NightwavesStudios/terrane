import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { NH48_LIST } from "../data/nh48";

export default function DataPage() {
  return (
    <div className="content-page">
      <PageHeader
        index="07"
        eyebrow="About / Data"
        title={
          <>
            Facts with a <span className="display-italic">paper trail.</span>
          </>
        }
        description="A mountain catalogue is only useful if you can see where every field came from. This page is the short, honest version."
      />

      <div className="data-layout">
        <section className="data-card">
          <p className="eyebrow">The first list</p>
          <h2>{NH48_LIST.title}</h2>
          <p>{NH48_LIST.description}</p>
          <dl className="data-facts">
            <div>
              <dt>Publisher</dt>
              <dd>
                <a href={NH48_LIST.publisherUrl} target="_blank" rel="noreferrer">
                  {NH48_LIST.publisher}
                </a>
              </dd>
            </div>
            <div>
              <dt>Edition</dt>
              <dd>{NH48_LIST.edition}</dd>
            </div>
            <div>
              <dt>Membership</dt>
              <dd>48 required peaks</dd>
            </div>
            <div>
              <dt>Official record</dt>
              <dd>No. The publisher is authoritative.</dd>
            </div>
          </dl>
          <p>
            <a href={NH48_LIST.sourceUrl} target="_blank" rel="noreferrer" className="text-link">
              Publisher list <span aria-hidden="true">→</span>
            </a>
          </p>
        </section>

        <section className="data-card">
          <p className="eyebrow">Peak facts</p>
          <h2>Where the fields come from.</h2>
          <table className="source-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Source</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Name</th>
                <td>NH48.info catalog</td>
                <td>Normalized only for display; source names preserved in the data.</td>
              </tr>
              <tr>
                <th scope="row">Coordinates</th>
                <td>OpenStreetMap via NH48.info</td>
                <td>Each peak page links its OSM node.</td>
              </tr>
              <tr>
                <th scope="row">Elevation, prominence</th>
                <td>USGS GNIS via NH48.info</td>
                <td>Stored in metres; displayed in chosen units.</td>
              </tr>
              <tr>
                <th scope="row">Membership</th>
                <td>AMC</td>
                <td>2026 edition; list rules belong to the publisher.</td>
              </tr>
              <tr>
                <th scope="row">Range</th>
                <td>NH48.info catalog</td>
                <td>Editorial grouping, not a survey boundary.</td>
              </tr>
            </tbody>
          </table>
          <p>
            <a href="https://nh48.info/catalog" target="_blank" rel="noreferrer" className="text-link">
              NH48.info catalog <span aria-hidden="true">→</span>
            </a>
          </p>
        </section>

        <section className="data-card">
          <p className="eyebrow">Phase A boundary</p>
          <h2>What is not here yet.</h2>
          <p>
            This build contains one complete list: the NH 48. It does not contain the other four launch lists, the
            469-peak local expansion, the global atlas or experiences. Those need complete membership, edition,
            licensing and provenance before they are published. An incomplete peak is worse than a missing one.
          </p>
          <p>
            The record is stored in this browser with <code>localStorage</code>. There is no production account,
            database, email or server-side backup in this workspace. Export is real and removes lock-in.
          </p>
          <div className="form-actions">
            <Link to="/progress" className="button">Your record</Link>
            <Link to="/lists/nh48" className="button button--bright">Open the NH 48</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
