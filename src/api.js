let csrf = '';
export async function api(url, options = {}) {
  const response = await fetch(`/api${url}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}), ...options.headers }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The station is out of reach. Please try again.');
  if (data.csrf) csrf = data.csrf;
  return data;
}
export function uploadAudio(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/editor/songs'); xhr.setRequestHeader('X-CSRF-Token', csrf);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => reject(new Error('Upload interrupted. Your existing library is safe. Please try again.'));
    xhr.timeout = 180000; xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
    xhr.onload = () => {
      let result; try { result = JSON.parse(xhr.responseText); } catch { return reject(new Error('Upload failed. Please try again.')); }
      xhr.status >= 200 && xhr.status < 300 ? resolve(result) : reject(new Error(result.error || 'Upload failed.'));
    };
    const form = new FormData(); form.append('audio', file); xhr.send(form);
  });
}
export function downloadText(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
