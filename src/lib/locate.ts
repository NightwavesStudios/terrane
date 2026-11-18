import { useEffect, useState } from "react";

/** Where the visitor is, as far as the internet can tell. */
export interface Home {
  lat: number;
  lon: number;
  city?: string;
  /** State, province or canton — `region` in the answer, `regionName` elsewhere. */
  region?: string;
  country?: string;
}

const KEY = "terrane:home";
const FAILED = "terrane:home:failed";

/* Session storage, not local: an IP lookup per tab is plenty, and a VPN turned
   on five minutes ago should not be remembered for a week. */
function read(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode: no cache, one request per load, fine */
  }
}

/**
 * Country and region from the visitor's IP address.
 *
 * Deliberately not `navigator.geolocation`: that opens a permission prompt on
 * first load, which is a heavy thing to ask before someone has even touched the
 * map, and it is far more precise than this needs to be. A country or a canton
 * is the whole question here — "which places are near you" — and an IP answer
 * costs one keyless GET that is cached for the tab.
 *
 * `https://ipwho.is/` is the endpoint: no key, CORS-enabled, returns country,
 * region and coordinates. A failure is not retried; the chip simply does not
 * appear, and the map works exactly as before.
 */
export async function locate(): Promise<Home | null> {
  const cached = read(KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as Home;
    } catch {
      /* fall through and fetch again */
    }
  }
  if (read(FAILED)) return null;

  try {
    const res = await fetch("https://ipwho.is/", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country?: string;
    };
    if (!body.success || typeof body.latitude !== "number" || typeof body.longitude !== "number") {
      throw new Error("no location");
    }
    const home: Home = {
      lat: body.latitude,
      lon: body.longitude,
      city: body.city,
      region: body.region,
      country: body.country,
    };
    write(KEY, JSON.stringify(home));
    return home;
  } catch {
    write(FAILED, "1");
    return null;
  }
}

/** One lookup per session, resolved after first paint. */
export function useHome(): Home | null {
  const [home, setHome] = useState<Home | null>(null);

  useEffect(() => {
    let live = true;
    const run = () => {
      locate().then((h) => {
        if (live) setHome(h);
      });
    };
    /* After the first frame, not on mount: the globe is fetching tiles and DEM in
       the first seconds, and an IP lookup competing with them buys a chip nobody
       is looking at yet at the cost of the map appearing later. */
    const idle = window.requestIdleCallback?.(run, { timeout: 2500 });
    const timer = idle ? null : window.setTimeout(run, 1200);
    return () => {
      live = false;
      if (idle) window.cancelIdleCallback?.(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return home;
}
