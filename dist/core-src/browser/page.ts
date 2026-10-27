export function pageBaseURI(): string | undefined {
  return typeof document === 'undefined' ? undefined : document.baseURI
}
