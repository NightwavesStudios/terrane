import type { Route } from "../lib/router";

/**
 * One navigation table for the three product surfaces.
 *
 * The globe is home. Lists and the log are the two things built around it.
 */
export type NavId = "globe" | "lists" | "log";

export type NavItem = {
  id: NavId;
  label: string;
  to: string;
  hint: string;
};

export const NAV: NavItem[] = [
  {
    id: "globe",
    label: "Globe",
    to: "/",
    hint: "The world of peaks, and what is around each one",
  },
  {
    id: "lists",
    label: "Lists",
    to: "/lists",
    hint: "The sourced peakbagging lists and your progress",
  },
  {
    id: "log",
    label: "Log",
    to: "/log",
    hint: "Every summit and place you have bagged or want to go",
  },
];

/** The tab a route belongs to. The log is a utility, not a destination. */
export function activeNav(route: Route): NavId | null {
  switch (route.name) {
    case "home":
    case "place":
    case "experience":
      return "globe";
    case "lists":
      return "lists";
    case "log":
      return "log";
    default:
      return null;
  }
}
