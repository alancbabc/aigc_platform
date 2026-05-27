import { getMediaUrl } from '../api/client';

export async function downloadResult(url, fallbackName = 'generated') {
  if (!url) return;
  const fullUrl = getMediaUrl(url);
  try {
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = url.split('/').pop() || fallbackName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(fullUrl, '_blank');
  }
}
