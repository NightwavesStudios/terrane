import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

interface Props {
  icon?: IconName;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export default function EmptyState({
  icon = "peak",
  eyebrow,
  title,
  description,
  children,
}: Props) {
  return (
    <section className="empty-state">
      <div className="empty-state__art" aria-hidden="true">
        <span className="empty-state__orbit empty-state__orbit--one" />
        <span className="empty-state__orbit empty-state__orbit--two" />
        <span className="empty-state__orbit empty-state__orbit--three" />
        <span className="empty-state__icon">
          <Icon name={icon} size={28} />
        </span>
      </div>
      <div className="empty-state__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        {children ? <div className="empty-state__actions">{children}</div> : null}
      </div>
    </section>
  );
}
