interface Props {
  completed: number;
  total: number;
  label?: string;
}

export default function ProgressRing({ completed, total, label = "peaks" }: Props) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="progress-ring" aria-label={`${completed} of ${total} ${label} complete`}>
      <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
        <circle className="progress-ring__track" cx="60" cy="60" r={radius} />
        <circle
          className="progress-ring__value"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="progress-ring__label">
        <strong>{percent}%</strong>
        <span>
          {completed}/{total} {label}
        </span>
      </div>
    </div>
  );
}
