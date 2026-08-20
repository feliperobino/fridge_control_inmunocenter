import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

const testUsers = [
  'phase2-user@example.com',
  'phase2-admin@example.com',
  'phase2-badpass@example.com'
];

async function createTestUser(email, password, role) {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role
    },
    create: {
      email,
      passwordHash,
      role
    }
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: testUsers
      }
    }
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: testUsers
      }
    }
  });

  await prisma.$disconnect();
});

describe('auth flow', () => {
  it('logs in successfully and issues access and refresh tokens', async () => {
    const email = 'phase2-user@example.com';
    const password = 'Password123!';

    await createTestUser(email, password, 'USER');

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.user).toMatchObject({
      email,
      role: 'USER'
    });
    expect(loginResponse.body.user.passwordHash).toBeUndefined();
    const setCookieHeader = loginResponse.headers['set-cookie'];
    const refreshCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
    expect(refreshCookie).toContain('refreshToken=');

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', setCookieHeader)
      .expect(200);

    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.user).toMatchObject({
      email,
      role: 'USER'
    });
  });

  it('rejects login with an incorrect password', async () => {
    const email = 'phase2-badpass@example.com';

    await createTestUser(email, 'CorrectPassword1!', 'USER');

    await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword1!' })
      .expect(401);
  });

  it('rejects access to protected routes without a token', async () => {
    await request(app).get('/api/users').expect(401);
  });

  it('rejects ADMIN-only routes for USER tokens', async () => {
    const adminEmail = 'phase2-admin@example.com';
    const userEmail = 'phase2-user@example.com';

    await createTestUser(adminEmail, 'AdminPassword123!', 'ADMIN');
    await createTestUser(userEmail, 'UserPassword123!', 'USER');

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: userEmail, password: 'UserPassword123!' })
      .expect(200);

    await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(403);
  });
});