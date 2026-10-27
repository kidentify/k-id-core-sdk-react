const LOCAL_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.test|\[.*\]|\d+\.\d+\.\d+\.\d+)$/i

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/**
 * The icon as declare sends it. A public https link goes as is for k-ID to fetch; anything k-ID cannot reach (a
 * path in the app's bundle, a local dev server, a blob) is read here and sent inline as a data URL.
 */
export async function declaredIconUrl(iconUrl: string, fetchImpl: typeof fetch, base?: string): Promise<string> {
  if (iconUrl.startsWith('data:') || iconUrl.trim() === '') return iconUrl
  let url: URL
  try {
    url = new URL(iconUrl, base)
  } catch {
    return iconUrl
  }
  if (url.protocol === 'https:' && !LOCAL_HOST.test(url.hostname)) return url.href
  const res = await fetchImpl(url.href)
  if (!res.ok) throw new Error(`Could not read the app icon at ${url.href} (${res.status}).`)
  const blob = await res.blob()
  return `data:${blob.type || 'application/octet-stream'};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`
}
