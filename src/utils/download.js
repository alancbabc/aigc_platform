import { showToast } from '../components/common/Toast';

export async function downloadResult(url, fallbackName = 'generated') {
  if (!url) return;
  let token = '';
  try {
    const stored = localStorage.getItem('aigc_auth');
    if (stored) token = JSON.parse(stored).token || '';
  } catch {}
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(url, { headers });
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
    showToast('下载失败，请稍后重试', 'error');
  }
}
