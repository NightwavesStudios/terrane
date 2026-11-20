/**
 * Whether the eight-second guard should show its failure message.
 *
 * A bare timeout accused a healthy map whenever the tab was suspended or
 * hidden: MapLibre's first style/frame is scheduled on the page's frame clock,
 * which a background tab may not advance. Readiness is therefore part of the
 * decision, not just elapsed time. A hidden tab never gets the message; a
 * visible tab that still has no style and no rendered tiles does.
 */
export type BootReadiness = {
  booted: boolean;
  styleLoaded: boolean;
  loaded: boolean;
  hidden: boolean;
};

export function shouldShowBootFailure(state: BootReadiness): boolean {
  if (state.booted || state.hidden) return false;
  return !state.styleLoaded && !state.loaded;
}
