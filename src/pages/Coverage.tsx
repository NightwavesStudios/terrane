import Header from "../components/Header";
import { navigate } from "../lib/router";
import { useCoverage } from "../lib/live";

/**
 * The published gap register.
 *
 * This is deliberately not a marketing page: every source says what it fetched,
 * what it placed, what it rejected and how old it is. The list of things no open
 * source covers is part of the data, not a footnote.
 */
export default function Coverage() {
  const coverage = useCoverage();
  const unknown = coverage?.gaps?.unknown ?? [];

  return (
    <div className="page">
      <Header tone="light" />
      <main className="coverage">
        <button className="back" onClick={() => navigate("/")}>
          ← Globe
        </button>
        <p className="eyebrow">Data</p>
        <h1 className="page-title">What the map knows, and what it doesn’t</h1>
        <p className="page-sub">
          Coverage is measured against the open sources Terrane ingests. It is not a
          census of the world: private campgrounds, informal sites and trails on private
          land are not in any open dataset.
        </p>

        {!coverage ? (
          <p className="mono coverage-loading">Reading coverage…</p>
        ) : (
          <>
            <div className="coverage-summary mono">
              <span>
                {coverage.totals.ok}/{coverage.totals.sources} sources healthy
              </span>
              <span>{coverage.totals.points.toLocaleString()} points</span>
              <span>{coverage.totals.trails.toLocaleString()} trail segments</span>
              <span>
                {coverage.generatedAt.slice(0, 10)}
                {coverage.totals.attention ? ` · ${coverage.totals.attention} need attention` : ""}
              </span>
            </div>

            <div className="coverage-table-wrap">
              <table className="coverage-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Coverage</th>
                    <th>Fetched</th>
                    <th>Placed</th>
                    <th>Age</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.sources.map((source) => (
                    <tr key={source.id} className={source.status === "ok" ? "" : "coverage-row--bad"}>
                      <td>
                        <strong>{source.name}</strong>
                        <span className="mono coverage-licence">{source.licence}</span>
                      </td>
                      <td>{source.coverage}</td>
                      <td className="mono">{source.fetched.toLocaleString()}</td>
                      <td className="mono">{source.placed.toLocaleString()}</td>
                      <td className="mono">{source.ageDays == null ? "—" : `${source.ageDays}d`}</td>
                      <td>
                        <span className={`coverage-status coverage-status--${source.status}`}>
                          {source.status}
                        </span>
                        {source.problems.length ? (
                          <span className="mono coverage-problem">{source.problems.join("; ")}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section className="coverage-gaps">
              <h2>What no source can give us</h2>
              <ul>
                {unknown.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
