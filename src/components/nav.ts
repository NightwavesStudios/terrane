import type { Route } from "../lib/router";

/**
 * One navigation table.
 *
 * The header and the phone tab bar used to repeat the same four destinations and
 * the same active-route rules in two files, which is how a place page ended up
 * with no active tab in the header. Both now read this list; a rename or a new
 * destination is one edit, not three.
 */
export type NavId = "discover" | "experiences" | "collections" | "saved";

export type NavItem = {
  id: NavId;
  label: string;
  /** Where the tab goes. */
  to: string;
  /** What the destination is, for the tab's accessible name. */
  hint: string;
};

export const NAV: NavItem[] = [
  {
    id: "discover",
    label: "Discover",
    to: "/",
    hint: "The globe and its search",
  },
  {
    id: "experiences",
    label: "Experiences",
    to: "/experiences",
    hint: "Curated destinations",
  },
  {
    id: "collections",
    label: "Collections",
    to: "/collections",
    hint: "Wide groups of Experiences",
  },
  {
    id: "saved",
    label: "Saved",
    to: "/saved",
    hint: "Your library, kept in this browser",
  },
];

/**
 * The tab a route belongs to. A place page belongs to Discover because that is
 * where it came from and where its back link returns; a coverage page is a
 * utility, not a destination, so it highlights nothing.
 */
export function activeNav(route: Route): NavId | null {
  switch (route.name) {
    case "home":
    case "place":
      return "discover";
    case "experiences":
    case "experience":
      return "experiences";
    case "collections":
    case "collection":
      return "collections";
    case "saved":
      return "saved";
    default:
      return null;
  }
}
