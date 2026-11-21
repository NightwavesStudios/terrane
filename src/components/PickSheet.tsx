import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/* Travel, in px, that counts as a gesture rather than a tap. */
const COLLAPSE_AT = 84;
const RESTORE_AT = 22;
/* Past this the sheet has left the screen anyway; stop following the finger. */
const MAX_DOWN = 320;

type SheetStyle = CSSProperties & { "--sheet-y": string };

/**
 * The place card as a bottom sheet.
 *
 * The header strip is the drag handle: pull it down and past 84 px and the card
 * minimises to a pill above the filter bar, which is dragged (or tapped) back
 * up. The close button lives in that strip rather than the card, so it stays put
 * while the body scrolls under it.
 *
 * On a desktop the strip and the scroll body are `display: contents`, and the
 * card is the same single row it has always been.
 */
export default function PickSheet({
  className,
  label,
  onClose,
  children,
}: {
  className: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [peek, setPeek] = useState(false);
  const [drag, setDrag] = useState({ active: false, offset: 0 });
  const startY = useRef(0);
  const travel = useRef(0);
  const active = useRef(false);
  const moved = useRef(false);

  function begin(event: ReactPointerEvent<HTMLElement>) {
    /* The sheet only exists under 900 px; on a desktop the card has no strip to
       grab, and a pointer down on the close button must stay a click. */
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    active.current = true;
    moved.current = false;
    travel.current = 0;
    startY.current = event.clientY;
    setDrag({ active: true, offset: 0 });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* A synthetic pointer has nothing to capture. */
    }
  }

  function move(event: ReactPointerEvent<HTMLElement>) {
    if (!active.current) return;
    const dy = event.clientY - startY.current;
    if (Math.abs(dy) > 3) moved.current = true;
    /* Open: only downward, and never past the screen. Minimised: only upward,
       and only far enough to show it is coming back. */
    travel.current = peek
      ? Math.min(0, Math.max(dy, -RESTORE_AT - 6))
      : Math.max(0, Math.min(dy, MAX_DOWN));
    setDrag({ active: true, offset: travel.current });
  }

  function finish() {
    if (!active.current) return;
    active.current = false;
    const distance = travel.current;
    travel.current = 0;
    setDrag({ active: false, offset: 0 });
    if (peek) {
      if (distance <= -RESTORE_AT || !moved.current) setPeek(false);
    } else if (distance >= COLLAPSE_AT) {
      setPeek(true);
    }
  }

  const style: SheetStyle = { "--sheet-y": `${drag.offset}px` };
  const handlers = {
    onPointerDown: begin,
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: finish,
  };

  if (peek) {
    return (
      <button
        className="pick-peek"
        style={style}
        data-dragging={drag.active ? "" : undefined}
        {...handlers}
        onClick={(event) => {
          /* Keyboard activation: a pointer tap already restores on release. */
          if (event.detail === 0) setPeek(false);
        }}
        aria-label={`Reopen ${label}`}
      >
        <span className="pick-peek-arrow" aria-hidden="true">
          ↑
        </span>
        <span className="pick-peek-name">{label}</span>
      </button>
    );
  }

  return (
    <aside
      className={className}
      style={style}
      data-dragging={drag.active ? "" : undefined}
      aria-live="polite"
    >
      <div className="pick-sheet-head" {...handlers}>
        <span className="pick-grip" aria-hidden="true" />
        <button
          className="pick-close"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Close place card"
        >
          ×
        </button>
      </div>
      <div className="pick-sheet-scroll">{children}</div>
    </aside>
  );
}
