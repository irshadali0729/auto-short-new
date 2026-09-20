// Turns a video title / channel name into a safe cross-platform filename
// component (used to name the saved output video after its source).
export function slugifyForFilename(value: string, maxLength = 60): string {
  const slug = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '') // strip characters illegal in Windows filenames
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug.slice(0, maxLength);
}

export function buildSavedVideoFilename(
  videoTitle?: string | null,
  channelName?: string | null,
): string {
  const titlePart = videoTitle ? slugifyForFilename(videoTitle) : '';
  const channelPart = channelName ? slugifyForFilename(channelName, 40) : '';

  const parts = [titlePart, channelPart].filter(Boolean);
  if (parts.length === 0) {
    return `hadith_shorts_${Date.now()}.mp4`;
  }
  return `${parts.join('__')}.mp4`;
}
