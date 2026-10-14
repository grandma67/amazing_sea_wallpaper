// URLs of the self-hosted files in public/assets. The site's base is relative
// ('./'), and relative URLs resolve against the script's location: on the
// page that's the page, but on the render worker it's the worker's script, so
// the worker is told the page's address (setAssetBase).

let base = new URL(`${import.meta.env.BASE_URL}assets/`, self.location.href)

/** Resolve assets relative to this page URL. */
export function setAssetBase(pageUrl: string): void {
  base = new URL(`${import.meta.env.BASE_URL}assets/`, pageUrl)
}

export const assetUrl = (name: string): string => new URL(name, base).href
