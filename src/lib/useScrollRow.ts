import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type KeyboardEvent,
  type PointerEvent,
  type UIEvent,
} from "react";

/**
 * A horizontal row of buttons that can actually be scrolled.
 *
 * The chip rows are wider than a phone and wider than the panel that holds
 * them, so they need the three things a native overflow strip does not give a
 * mouse: drag to scroll, an edge fade that says there is more, and arrow keys
 * that move between the buttons. Touch keeps its own momentum scrolling; the
 * drag handler only binds a primary mouse button so it never fights it.
 */

type Edges = { start: boolean; end: boolean };

const DRAG_THRESHOLD = 4;

export function useScrollRow() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<Edges>({ start: false, end: false });
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft > 4;
    const end = max > 4 && el.scrollLeft < max - 4;
    setEdges((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
  }, []);

  /* A chip can arrive after the first paint (the scope chip waits for the IP
     lookup), which changes what overflows. Watch the box, and re-measure once
     more after a frame for the case a resize observer cannot see. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [measure]);

  const onScroll = useCallback(
    (_event?: UIEvent<HTMLDivElement>) => measure(),
    [measure],
  );

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    drag.current = {
      active: true,
      startX: event.clientX,
      startLeft: el.scrollLeft,
      moved: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* A synthetic pointer has nothing to capture. */
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!drag.current.active || !el) return;
    const dx = event.clientX - drag.current.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    drag.current.active = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* The capture already ended. */
    }
    measure();
  }

  /* A drag that moved the row is not a click on the chip it started on. The
     flag is cleared on the next tick so the click that follows this capture is
     the one that gets swallowed. */
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!drag.current.moved) return;
    drag.current.moved = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      el.querySelectorAll<HTMLElement>("[data-row-item]"),
    ).filter((item) => !item.hasAttribute("disabled"));
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = current;
    if (event.key === "ArrowRight") next = current < 0 ? 0 : Math.min(items.length - 1, current + 1);
    else if (event.key === "ArrowLeft") next = current < 0 ? items.length - 1 : Math.max(0, current - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    const target = items[next];
    if (!target) return;
    event.preventDefault();
    target.focus();
    revealRowItem(target);
  }

  return {
    ref,
    edges,
    handlers: {
      onScroll,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onClickCapture,
      onKeyDown,
    },
  };
}

/** Bring an activated chip fully into view without moving the page. */
export function revealRowItem(element: HTMLElement | null) {
  element?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}
