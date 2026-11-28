import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { LISTS } from "../data/lists";

export default function DataPage() {
  return (
    <div className="content-page">
      <PageHeader
        eyebrow="About / Data"
        title={
          <>
            Data &amp; <span className="display-italic">sources.</span>
          </>
        }
        description="Where every list, height and coordinate came from."
      />

      <div className="data-layout">
        <section className="data-card">
          <p className="eyebrow">The complete lists</p>
          <h2>Five publishers, five rule sets.</h2>
          <table className="source-table">
            <thead>
              <tr>
                <th scope="col">List</th>
                <th scope="col">Peaks</th>
                <th scope="col">Publisher / edition</th>
                <th scope="col">Rule note</th>
              </tr>
            </thead>
            <tbody>
              {LISTS.map((list) => (
                <tr key={list.id}>
                  <th scope="row">
                    <Link to={`/lists/${list.slug}`}>{list.title}</Link>
                  </th>
                  <td data-label="Peaks">{list.peaks.length}</td>
                  <td data-label="Publisher">
                    <a href={list.sourceUrl} target="_blank" rel="noreferrer">
                      {list.publisher}
                    </a>
                    <br />
                    {list.edition}
                    {list.license ? (
                      <>
                        <br />
                        <small>{list.license}</small>
                      </>
                    ) : null}
                  </td>
                  <td data-label="Rule note">{list.rules}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            The Colorado 14ers list is inclusive: 58 named summits. 53 clear 300 feet of prominence and the
            Colorado Mountain Club recognises 54 for completion. Terrane does not collapse that difference into a
            single “official” count. The Munros are the SMC's 282-peak list; DoBIH v18 supplies heights, drops,
            coordinates and regions under CC BY 4.0. The Catskill list is the current 33 peaks after the 2021
            revision, and its four winter repeats are a membership rule, not extra list entries.
          </p>
        </section>

        <section className="data-card">
          <p className="eyebrow">Peak facts</p>
          <h2>Where the fields come from.</h2>
          <table className="source-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">NH 48</th>
                <th scope="col">Colorado 14ers</th>
                <th scope="col">Munros</th>
                <th scope="col">ADK 46</th>
                <th scope="col">Catskills</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Name</th>
                <td data-label="NH 48">NH48.info catalog</td>
                <td data-label="Colorado 14ers">14ers.com; NGS 2024 name changes reflected</td>
                <td data-label="Munros">DoBIH v18</td>
                <td data-label="ADK 46">Wikipedia / Adirondack 46ers</td>
                <td data-label="Catskills">Catskill Hiker / 3500 Club</td>
              </tr>
              <tr>
                <th scope="row">Coordinates</th>
                <td data-label="NH 48">OpenStreetMap via NH48.info</td>
                <td data-label="Colorado 14ers">14ers.com peak pages</td>
                <td data-label="Munros">DoBIH v18 latitude/longitude</td>
                <td data-label="ADK 46">Wikipedia coordinates</td>
                <td data-label="Catskills">Catskill Hiker coordinates</td>
              </tr>
              <tr>
                <th scope="row">Elevation</th>
                <td data-label="NH 48">USGS GNIS via NH48.info</td>
                <td data-label="Colorado 14ers">NGS 2024 / 5280 table</td>
                <td data-label="Munros">DoBIH v18 height</td>
                <td data-label="ADK 46">Club/Wikipedia height</td>
                <td data-label="Catskills">Catskill Hiker height</td>
              </tr>
              <tr>
                <th scope="row">Prominence</th>
                <td data-label="NH 48">USGS GNIS via NH48.info</td>
                <td data-label="Colorado 14ers">14ers.com peak pages</td>
                <td data-label="Munros">DoBIH v18 drop</td>
                <td data-label="ADK 46">Wikipedia prominence</td>
                <td data-label="Catskills">Not supplied</td>
              </tr>
              <tr>
                <th scope="row">Membership</th>
                <td data-label="NH 48">AMC, 2026 edition</td>
                <td data-label="Colorado 14ers">14ers.com named list; CMC 54 noted</td>
                <td data-label="Munros">SMC 282 list</td>
                <td data-label="ADK 46">Adirondack 46ers</td>
                <td data-label="Catskills">3500 Club 33 current</td>
              </tr>
            </tbody>
          </table>
          <p>
            Each peak page links its source. List membership and rules belong to the publisher; Terrane is not an
            official finisher record.
          </p>
        </section>

        <section className="data-card">
          <p className="eyebrow">Current boundary</p>
          <h2>What is not here yet.</h2>
          <p>
            This build contains five complete lists: the NH 48, the 58 named Colorado 14ers, the 282 Munros, the
            Adirondack 46 and the current 33-peak Catskill 3500 list. It does not contain a global peak catalogue
            or sourced experiences. Those need complete membership, edition, licensing and provenance before they
            are published.
          </p>
          <p>
            The record is stored in this browser with <code>localStorage</code>. There is no production account,
            database, email or server-side backup in this workspace. Export is real and removes lock-in.
          </p>
          <div className="form-actions">
            <Link to="/progress" className="button">Your record</Link>
            <Link to="/lists" className="button button--bright">Open the lists</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
