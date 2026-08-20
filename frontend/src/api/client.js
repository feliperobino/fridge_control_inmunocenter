import { clearAccessToken, getAccessToken, setAccessToken } from '../auth/session.js';

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith('/')) {
    return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
  }

  return `${apiBaseUrl.replace(/\/$/, '')}/${path}`;
}

function isPlainObject(value) {
  return Boolean(value) && Object.getPrototypeOf(value) === Object.prototype;
}

async function readResponse(response, responseType = 'json') {
  if (response.status === 204) {
    return null;
  }

  if (responseType === 'blob') {
    return response.blob();
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/pdf') || contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    return response.blob();
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createApiError(message, status, data) {
  const error = new Error(message);
  error.status = status;
  error.data = data;
  return error;
}

async function refreshAccessToken() {
  // log refresh attempt
  // eslint-disable-next-line no-console
  console.log('API: refreshAccessToken ->', buildUrl('/auth/refresh'));
  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  const data = await readResponse(response);

  if (!response.ok) {
    clearAccessToken();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('fridge-monitor:session-expired'));
    }

    throw createApiError('Unable to refresh session', response.status, data);
  }

  if (data?.accessToken) {
    setAccessToken(data.accessToken);
  }

  return data;
}

export async function apiRequest(path, options = {}, config = {}) {
  const { auth = true, retryOn401 = true, responseType = 'json' } = config;
  const headers = new Headers(options.headers || {});
  const requestOptions = {
    ...options,
    credentials: options.credentials || 'include',
    headers
  };

  if (auth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  if (isPlainObject(requestOptions.body)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  const executeRequest = async () => {
    // eslint-disable-next-line no-console
    console.log('API request ->', { method: requestOptions.method || 'GET', url: buildUrl(path), headers: Object.fromEntries(requestOptions.headers || []), body: requestOptions.body });
    const response = await fetch(buildUrl(path), requestOptions);
    const data = await readResponse(response, responseType);

    // eslint-disable-next-line no-console
    console.log('API response <-', { status: response.status, statusText: response.statusText, url: response.url, body: data });

    if (response.ok) {
      return data;
    }

    if (response.status === 401 && auth && retryOn401) {
      await refreshAccessToken();

      const retryHeaders = new Headers(requestOptions.headers);
      const retryToken = getAccessToken();

      if (retryToken) {
        retryHeaders.set('Authorization', `Bearer ${retryToken}`);
      } else {
        retryHeaders.delete('Authorization');
      }

      const retryResponse = await fetch(buildUrl(path), {
        ...requestOptions,
        headers: retryHeaders
      });
      const retryData = await readResponse(retryResponse, responseType);

      if (retryResponse.ok) {
        return retryData;
      }

      throw createApiError(retryData?.error || 'Request failed', retryResponse.status, retryData);
    }

    throw createApiError(data?.error || 'Request failed', response.status, data);
  };

  return executeRequest();
}

export async function apiLogin(email, password) {
  // eslint-disable-next-line no-console
  console.log('apiLogin called for', email);
  return apiRequest(
    '/auth/login',
    {
      method: 'POST',
      body: { email, password }
    },
    { auth: false, retryOn401: false }
  );
}

export async function apiLogout() {
  return apiRequest(
    '/auth/logout',
    {
      method: 'POST'
    },
    { auth: false, retryOn401: false }
  );
}

export async function apiRefresh() {
  return refreshAccessToken();
}