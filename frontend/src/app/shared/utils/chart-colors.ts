/** Resolves a CSS custom property from :root / documentElement */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
