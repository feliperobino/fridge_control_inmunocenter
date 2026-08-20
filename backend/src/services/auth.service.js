import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import env from '../config/env.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

function buildTokenPayload(user) {
  return {
    sub: user.id,
    email: user.email,
    role: user.role
  };
}

export async function loginUser(email, password) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    return {
      user,
      accessToken: jwt.sign(buildTokenPayload(user), env.jwtAccessSecret, {
        expiresIn: ACCESS_TOKEN_TTL
      }),
      refreshToken: jwt.sign(buildTokenPayload(user), env.jwtRefreshSecret, {
        expiresIn: REFRESH_TOKEN_TTL
      })
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('auth.service.loginUser error', err && (err.stack || err.message || err));
    throw err;
  }
}

export async function refreshAccessToken(refreshToken) {
  const payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user) {
    return null;
  }

  return {
    user,
    accessToken: jwt.sign(buildTokenPayload(user), env.jwtAccessSecret, {
      expiresIn: ACCESS_TOKEN_TTL
    })
  };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}
