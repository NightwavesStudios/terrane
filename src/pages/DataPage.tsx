import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { LISTS } from "../data/lists";

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
          <p className="eyebrow">The complete lists</p>
          <h2>Three publishers, three rule sets.</h2>
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
                  <td>{list.peaks.length}</td>
                  <td>
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
                  <td>{list.rules}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            The Colorado 14ers list is inclusive: 58 named summits. 53 clear 300 feet of prominence and the
            Colorado Mountain Club recognises 54 for completion. Terrane does not collapse that difference into a
            single “official” count. The Munros are the SMC's 282-peak list; DoBIH v18 supplies heights, drops,
            coordinates and regions under CC BY 4.0.
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
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Name</th>
                <td>NH48.info catalog</td>
                <td>14ers.com; NGS 2024 name changes reflected</td>
                <td>DoBIH v18</td>
              </tr>
              <tr>
                <th scope="row">Coordinates</th>
                <td>OpenStreetMap via NH48.info</td>
                <td>14ers.com peak pages</td>
                <td>DoBIH v18 latitude/longitude</td>
              </tr>
              <tr>
                <th scope="row">Elevation</th>
                <td>USGS GNIS via NH48.info</td>
                <td>NGS 2024 / 5280 table</td>
                <td>DoBIH v18 height</td>
              </tr>
              <tr>
                <th scope="row">Prominence</th>
                <td>USGS GNIS via NH48.info</td>
                <td>14ers.com peak pages</td>
                <td>DoBIH v18 drop</td>
              </tr>
              <tr>
                <th scope="row">Membership</th>
                <td>AMC, 2026 edition</td>
                <td>14ers.com named list; CMC 54 noted</td>
                <td>SMC 282 list</td>
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
            This build contains three complete lists: the NH 48, the 58 named Colorado 14ers and the 282 Munros.
            It does not contain the ADK 46, Catskill 3500, a global peak catalogue or sourced experiences. Those
            need complete membership, edition, licensing and provenance before they are published.
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
