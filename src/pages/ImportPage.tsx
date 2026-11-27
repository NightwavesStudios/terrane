import { useState, type ChangeEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { PEAKS } from "../data/lists";
import { IMPORT_HEADERS, IMPORT_TEMPLATE, parseImportCsv, type ImportPreview } from "../lib/import";
import { useRecord } from "../state/RecordContext";
import type { NewTripInput } from "../types/record";

const PEAK_NAMES = new Map(PEAKS.map((peak) => [peak.slug, peak.name]));
type Action = "merge" | "keep" | "skip";

function downloadTemplate() {
  const blob = new Blob([IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "terrane-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function defaultActions(preview: ImportPreview): Record<string, Action> {
  return Object.fromEntries(
    preview.groups.map((group) => [group.key, group.duplicateTripId ? "merge" : "keep"]),
  );
}

export default function ImportPage() {
  const { profile, trips, hydrated, importTrips, mergeTripPeaks } = useRecord();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [actions, setActions] = useState<Record<string, Action>>({});
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");

  if (!hydrated) return <div className="content-page" aria-busy="true" />;
  if (!profile) {
    return <Navigate to={`/signin?returnTo=${encodeURIComponent("/import")}`} replace />;
  }

  function runParse(value = text) {
    const result = parseImportCsv(value, trips);
    setPreview(result);
    setActions(defaultActions(result));
    setMessage("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((contents) => {
        setFileName(file.name);
        setText(contents);
        runParse(contents);
      })
      .catch(() => setMessage("That file could not be read. Paste the CSV instead."));
  }

  function commit() {
    if (!preview) return;
    const inputs: NewTripInput[] = [];
    let merged = 0;
    let skipped = 0;

    for (const group of preview.groups) {
      const action = actions[group.key] ?? (group.duplicateTripId ? "merge" : "keep");
      if (action === "skip") {
        skipped += 1;
        continue;
      }
      if (action === "merge" && group.duplicateTripId) {
        mergeTripPeaks(group.duplicateTripId, group.peaks);
        merged += 1;
        continue;
      }
      inputs.push({
        title: group.title,
        date: group.date,
        precision: group.precision,
        source: "backfill",
        notes: group.notes,
        peakSlugs: group.peaks.map((peak) => peak.slug),
        outcome: group.peaks[0]?.outcome ?? "summit",
        peaks: group.peaks,
      });
    }

    const created = importTrips(inputs);
    const parts = [
      created.length ? `${created.length} ${created.length === 1 ? "trip" : "trips"} imported` : "",
      merged ? `${merged} merged` : "",
      skipped ? `${skipped} skipped` : "",
      preview.errors.length ? `${preview.errors.length} rows rejected` : "",
    ].filter(Boolean);
    setMessage(`${parts.join(" · ")}. The record is updated.`);
    setPreview(null);
    setText("");
    setFileName("");
  }

  return (
    <div className="content-page">
      <PageHeader
        index="08"
        eyebrow="Record / Import"
        title={
          <>
            Bring the <span className="display-italic">archive.</span>
          </>
        }
        description="Import a CSV of past climbs, review every match and decide what happens to duplicates before anything is committed."
        aside={
          <div className="status-card">
            <span className="status-card__label">Stored locally</span>
            <strong>{trips.length} trips</strong>
            <span>Nothing is uploaded</span>
          </div>
        }
      />

      <div className="import-layout">
        <section className="import-card">
          <p className="eyebrow">01 / The file</p>
          <h2>One row per peak.</h2>
          <p>
            The template uses a header row. Required: <code>date</code> and either{" "}
            <code>peak_slug</code> or <code>peak_name</code>. Optional: <code>trip_id</code>,{" "}
            <code>precision</code>, <code>outcome</code>, <code>title</code>, <code>notes</code>.
            Rows with the same <code>trip_id</code> become one trip.
          </p>
          <div className="import-template">
            <code>{IMPORT_HEADERS.join(" · ")}</code>
            <button type="button" className="button" onClick={downloadTemplate}>
              <Icon name="download" size={15} /> Download template
            </button>
          </div>

          <label className="form-field">
            <span>Choose a CSV</span>
            <input type="file" accept=".csv,text/csv,text/plain" onChange={chooseFile} />
          </label>
          <label className="form-field">
            <span>{fileName ? `Paste or edit ${fileName}` : "Or paste the CSV"}</span>
            <textarea
              rows={9}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setPreview(null);
                setMessage("");
              }}
              placeholder={IMPORT_TEMPLATE}
              spellCheck={false}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="button button--bright"
              onClick={() => runParse()}
              disabled={!text.trim()}
            >
              Review import
            </button>
            <Link to="/settings" className="button">Cancel</Link>
          </div>
        </section>

        <aside className="import-aside">
          <p className="eyebrow">The contract</p>
          <h2>Nothing is silently dropped.</h2>
          <ul>
            <li>Unmatched peaks and invalid dates are listed by row and never imported.</li>
            <li>A duplicate peak on the same date offers merge, keep separate or skip.</li>
            <li>Progress is recalculated from the resulting trips, so the list count matches a hand count.</li>
            <li>Export first if this browser is the only copy.</li>
          </ul>
          <p className="muted-note">
            Dates keep the precision in the file. A year-only climb is not turned into January 1.
          </p>
        </aside>
      </div>

      {message ? <p className="form-success" role="status">{message}</p> : null}

      {preview ? (
        <section className="import-review" aria-labelledby="import-review-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">02 / Review</p>
              <h2 id="import-review-title">
                {preview.groups.length} {preview.groups.length === 1 ? "trip" : "trips"} ready
              </h2>
            </div>
            <span className="panel-heading__meta">
              {preview.validRows} of {preview.rowCount} rows valid
            </span>
          </div>

          {preview.errors.length ? (
            <div className="import-errors" role="alert">
              <strong>{preview.errors.length} rows need attention</strong>
              <ul>
                {preview.errors.map((error) => (
                  <li key={`${error.rowNumber}-${error.message}`}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted-note">Every data row matched the catalogue.</p>
          )}

          {preview.groups.length ? (
            <div className="import-table" role="table" aria-label="Import review">
              <div className="import-table__head" role="row">
                <span role="columnheader">Trip</span>
                <span role="columnheader">Peaks</span>
                <span role="columnheader">Duplicate</span>
                <span role="columnheader">Action</span>
              </div>
              {preview.groups.map((group) => {
                const action = actions[group.key] ?? (group.duplicateTripId ? "merge" : "keep");
                return (
                  <div className="import-row" role="row" key={group.key}>
                    <span role="cell">
                      <strong>{group.title}</strong>
                      <small>{group.date} · {group.precision}</small>
                    </span>
                    <span role="cell">
                      {group.peaks.map((peak) => PEAK_NAMES.get(peak.slug) ?? peak.slug).join(", ")}
                    </span>
                    <span role="cell">
                      {group.duplicateTripId
                        ? group.duplicatePeaks.map((slug) => PEAK_NAMES.get(slug) ?? slug).join(", ")
                        : "None"}
                    </span>
                    <span role="cell">
                      <select
                        aria-label={`Action for ${group.title}`}
                        value={action}
                        onChange={(event) =>
                          setActions((current) => ({
                            ...current,
                            [group.key]: event.target.value as Action,
                          }))
                        }
                      >
                        {group.duplicateTripId ? <option value="merge">Merge</option> : null}
                        <option value="keep">Keep separate</option>
                        <option value="skip">Skip</option>
                      </select>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="button button--bright"
              onClick={commit}
              disabled={!preview.groups.length}
            >
              <Icon name="check" size={16} /> Commit import
            </button>
            <button type="button" className="button" onClick={() => setPreview(null)}>
              Back to the file
            </button>
          </div>
        </section>
      ) : null}

      {message ? (
        <p>
          <Link to="/progress" className="text-link">
            See the updated progress <span aria-hidden="true">→</span>
          </Link>
        </p>
      ) : null}

      {message ? (
        <button type="button" className="text-link import-refresh" onClick={() => navigate(0)}>
          Import another file
        </button>
      ) : null}
    </div>
  );
}
