/**
 * Resolves media paths (local files, nested subdirectory paths, remote URLs, or data URLs)
 * into a safe, valid browser URL.
 */
export function getMediaUrl(mediaPath?: string): string {
  if (!mediaPath) return '';
  
  // Remote URLs or data URLs
  if (
    mediaPath.startsWith('http://') || 
    mediaPath.startsWith('https://') || 
    mediaPath.startsWith('data:') || 
    mediaPath.startsWith('blob:')
  ) {
    return mediaPath;
  }

  // Already prefixed with /api/images
  if (mediaPath.startsWith('/api/images/')) {
    return mediaPath;
  }

  // Clean relative or nested paths (e.g., "host/women_host/gesture-1.mp4" or "pexels-123.jpg")
  const normalized = mediaPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const encodedSegments = normalized.split('/').map(segment => encodeURIComponent(segment)).join('/');
  
  return `/api/images/${encodedSegments}`;
}

export function isVideoAsset(mediaPath?: string): boolean {
  if (!mediaPath) return false;
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(mediaPath);
}
