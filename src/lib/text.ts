/**
 * One comparison form for every name the app searches.
 *
 * Place names arrive from Wikidata and OpenStreetMap with accents, apostrophes,
 * hyphens and leading articles, and a reader types none of that. `normalize`
 * folds diacritics, drops punctuation and collapses whitespace, so "Zürich",
 * "ZURICH" and "zurich" are one token and "’Opaeka’a Falls" answers to "opaeka".
 */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A word or phrase as tokens, empty entries dropped. */
export function words(value: string): string[] {
  const norm = normalize(value);
  return norm ? norm.split(" ") : [];
}

/** Crude singular, used only to look up a category synonym ("falls" → "fall"). */
export function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}
