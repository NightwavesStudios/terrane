import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  aside?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ eyebrow, title, description, aside, actions }: Props) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="page-header__lede">{description}</p> : null}
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
      {aside ? <div className="page-header__aside">{aside}</div> : null}
    </header>
  );
}
