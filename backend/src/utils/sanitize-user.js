export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const safeUser = { ...user };
  delete safeUser.passwordHash;
  return safeUser;
}
