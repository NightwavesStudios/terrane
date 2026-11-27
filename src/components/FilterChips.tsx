interface Props {
  label: string;
  items: string[];
  active?: string;
  onSelect?: (value: string) => void;
}

export default function FilterChips({ label, items, active, onSelect }: Props) {
  return (
    <div className="filter-chips">
      <span className="filter-chips__label">{label}</span>
      <div className="filter-chips__row" role="group" aria-label={label}>
        {items.map((item) => (
          <button
            key={item}
            className={`chip${active === item ? " chip--active" : ""}`}
            type="button"
            aria-pressed={active === item}
            onClick={() => onSelect?.(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
