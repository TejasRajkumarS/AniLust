// Authentication utilities
// The password hashing logic has been moved to the backend (bcryptjs).
// These client-side utilities are kept for backward compatibility and
// migration purposes only.

export const hashPassword = (password: string): string => {
  // DEPRECATED: This is a demo-grade hash. Use the backend API for real auth.
  console.warn('[DEPRECATION] hashPassword is deprecated. Use backend auth API instead.');
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

export const verifyPassword = (password: string, hash: string): boolean => {
  console.warn('[DEPRECATION] verifyPassword is deprecated. Use backend auth API instead.');
  return hashPassword(password) === hash;
};
