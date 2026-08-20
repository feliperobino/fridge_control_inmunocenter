import { loginUser, refreshAccessToken } from '../services/auth.service.js';
import { parseCookieHeader, serializeCookie } from '../utils/cookie.js';
import { sanitizeUser } from '../utils/sanitize-user.js';

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/api/auth/refresh'
};

function sendRefreshCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie('refreshToken', token, {
      ...refreshCookieOptions,
      maxAge: 60 * 60 * 24 * 7
    })
  );
}

function clearRefreshCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie('refreshToken', '', {
      ...refreshCookieOptions,
      maxAge: 0
    })
  );
}

export async function login(req, res) {
  // minimal request logging to help debug proxy/socket issues
  // eslint-disable-next-line no-console
  console.log('POST /api/auth/login received', { ip: req.ip, body: req.body && { ...req.body, password: req.body.password ? '***' : undefined } });

  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await loginUser(email, password);

    if (!result) {
      // eslint-disable-next-line no-console
      console.log('POST /api/auth/login invalid credentials for', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    sendRefreshCookie(res, result.refreshToken);

    return res.json({
      accessToken: result.accessToken,
      user: sanitizeUser(result.user)
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('POST /api/auth/login error', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function refresh(req, res) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const refreshToken = cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await refreshAccessToken(refreshToken);
    if (!result) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    sendRefreshCookie(res, refreshToken);

    return res.json({
      accessToken: result.accessToken,
      user: sanitizeUser(result.user)
    });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export async function logout(req, res) {
  clearRefreshCookie(res);
  return res.status(204).send();
}
