import type { ReactNode } from "react";

interface Props {
  index: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
  aside?: ReactNode;
}

export default function PageHeader({ index, eyebrow, title, description, aside }: Props) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        <p className="eyebrow">
          <span>{index}</span> / {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="page-header__lede">{description}</p>
      </div>
      {aside ? <div className="page-header__aside">{aside}</div> : null}
    </header>
  );
}
