import { category } from "../../data/features";
import type { CatalogRow } from "../../lib/catalog";
import { formatKm } from "../../lib/present";

/** A list of destination rows: name, category, distance. */
export default function RelationList({
  items,
  onOpen,
}: {
  items: { row: CatalogRow; km: number }[];
  onOpen: (row: CatalogRow) => void;
}) {
  return (
    <ol className="around-list">
      {items.map(({ row, km }) => (
        <li key={row.key}>
          <button className="around-row" onClick={() => onOpen(row)}>
            <span className="around-name">{row.name}</span>
            <span className="around-type mono">{category(row.cat).one}</span>
            <span className="around-km mono">{formatKm(km)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
