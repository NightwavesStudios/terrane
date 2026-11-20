import type { ReactNode } from "react";

/** One section on a place page: the heading, an optional note, the content. */
export default function PlaceSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="around">
      <div className="around-head">
        <h2>{title}</h2>
        {note ? <span className="mono around-note">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}
