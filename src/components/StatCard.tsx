interface Props {
  label: string;
  value: string;
  unit: string;
  note: string;
}

export default function StatCard({ label, value, unit, note }: Props) {
  return (
    <article className="stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">
        {value}
        <span>{unit}</span>
      </strong>
      <span className="stat-card__note">{note}</span>
    </article>
  );
}
