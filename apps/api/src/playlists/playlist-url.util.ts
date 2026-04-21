/**
 * Xtream Codes panels serve two flavours of M3U from `get.php`:
 *   - type=m3u       → bare URLs + channel names, no group-title, no tvg-logo
 *   - type=m3u_plus  → same content PLUS group-title and tvg-logo attributes
 *
 * Any sensible player wants the annotated variant, so we canonicalise any URL
 * that looks like an Xtream `get.php` request to use `m3u_plus`. The upgrade is
 * strictly additive — every player that handles `m3u` also handles `m3u_plus`.
 *
 * Non-Xtream URLs (plain CDN-hosted .m3u8, GitHub gist links, etc.) are left
 * untouched.
 */
export function normalizeXtreamPlaylistUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  // Heuristic: only touch URLs that end in /get.php and carry username+password.
  // That uniquely identifies the Xtream Codes protocol.
  if (!parsed.pathname.endsWith('/get.php')) return rawUrl;
  if (!parsed.searchParams.has('username')) return rawUrl;
  if (!parsed.searchParams.has('password')) return rawUrl;

  const type = parsed.searchParams.get('type');
  if (type === 'm3u') {
    parsed.searchParams.set('type', 'm3u_plus');
    return parsed.toString();
  }

  // If `type` is missing entirely, explicitly add m3u_plus. Most panels
  // default to m3u when type is absent.
  if (type === null) {
    parsed.searchParams.set('type', 'm3u_plus');
    return parsed.toString();
  }

  return rawUrl;
}
