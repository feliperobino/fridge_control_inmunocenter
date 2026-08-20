import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { sanitizeUser } from '../utils/sanitize-user.js';

function parseRole(role) {
  if (role === 'ADMIN' || role === 'USER') {
    return role;
  }

  return null;
}

export async function listUsers(req, res) {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return res.json(users.map(sanitizeUser));
}

export async function createUser(req, res) {
  const { email, password, role } = req.body || {};
  const normalizedRole = parseRole(role);

  if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || !password || !normalizedRole) {
    return res.status(400).json({ error: 'Valid email, password and role are required' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: normalizedRole
    }
  });

  return res.status(201).json(sanitizeUser(user));
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const { role, password } = req.body || {};
  const data = {};

  if (role !== undefined) {
    const normalizedRole = parseRole(role);
    if (!normalizedRole) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    data.role = normalizedRole;
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    data.passwordHash = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data
  });

  return res.json(sanitizeUser(user));
}

export async function deleteUser(req, res) {
  const { id } = req.params;
  await prisma.user.delete({ where: { id } });
  return res.status(204).send();
}
