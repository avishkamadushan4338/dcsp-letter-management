// Thin fetch wrapper shared by every page. Always sends cookies (DCS session)
// and surfaces server error messages.
window.api = (() => {
  const BASE = window.APP_CONFIG.API_BASE;

  async function request(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
  };
})();
