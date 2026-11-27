# Terrane data sources

The catalogue is deliberately small and complete. A list publishes only when every member peak has an identity, a point and a visible source. Fields not supported by a source remain unknown.

## New Hampshire 48

| Field | Source |
|---|---|
| Membership, ranks and rules | [Appalachian Mountain Club](https://www.amc4000footer.org/whitemountainfourk.html), 2026 edition |
| Name, elevation, prominence, coordinates | [NH48.info catalog](https://nh48.info/catalog), citing USGS GNIS and OpenStreetMap |
| Peak links | OpenStreetMap node URLs stored per peak |

48 of 48 entries are present. Elevations and prominence are stored in metres from the source and displayed in the selected units; exact imperial values are preserved where the source provides them.

## Colorado 14ers

| Field | Source |
|---|---|
| Named membership | [14ers.com](https://www.14ers.com/14ers) |
| Elevation | NGS 2024 values published by [5280](https://5280.com/the-revised-list-of-colorados-14000-foot-peaks-by-elevation) |
| Coordinates, ranges, prominence | Individual 14ers.com peak pages |

58 named summits are present. The rule is not flattened:

- 58 named fourteeners are listed.
- 53 clear 300 feet of prominence.
- The Colorado Mountain Club recognises 54 for completion.

Terrane shows the named list and says so. It does not call the list “official” or grant finisher status. The Colorado slug for Mount Lincoln is `mount-lincoln-co` because New Hampshire also has a Mount Lincoln; names stay unchanged on screen.

## Munros

| Field | Source |
|---|---|
| Membership and rules | [Scottish Mountaineering Club](https://www.smc.org.uk/hills), 282 Munros |
| Name, height, drop, coordinates, region | [Database of British and Irish Hills v18](https://www.hill-bagging.co.uk/dobih/downloads) |

All 282 entries are present. Heights are metres and feet from DoBIH; drops are metres. Coordinates are WGS84 latitude/longitude. The DoBIH is licensed CC BY 4.0 and is attributed in the app and on every peak page. The SMC list is membership; DoBIH is the fact source. Names are kept as published, including bracketed alternative names. Duplicate names use section-qualified slugs so every identity is unique.

## Checked dates and limits

- Seed retrieval: November 2026.
- No global peak inventory, ADK 46 or Catskill 3500 data is included in this build.
- No elevation is invented for an unknown field. No peak is added to complete a count.
- Terrane summaries are its own words; publisher names, editions and links are attributed.

## CSV import format

One row per peak. UTF-8 CSV with a header row; quoted fields may contain commas, doubled quotes and newlines.

| Column | Required | Notes |
|---|---|---|
| `date` | Yes | `YYYY-MM-DD`, `YYYY-MM` or `YYYY`; interpreted with `precision` |
| `peak_slug` | One of these | Stable catalogue slug |
| `peak_name` | One of these | Exact catalogue name, case-insensitive |
| `trip_id` | No | Rows sharing it become one trip |
| `precision` | No | `day` (default), `month`, `year` |
| `outcome` | No | `summit` (default), `attempt`, `traverse` |
| `title` | No | Trip title |
| `notes` | No | Free text |

The in-app template adds `source` and `peak_name` for round-tripping an export. Invalid rows are reported with row numbers and are never silently imported. A duplicate peak on the same date offers merge, keep separate or skip before commit.
