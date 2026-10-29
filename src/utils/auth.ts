// Authentication utilities
// NOTE: This is a demo-grade, localStorage-only auth system (no backend
// accounts). The hash below is NOT cryptographically secure — if real
// accounts are ever needed, replace with a proper backend + bcrypt/argon2.
export const hashPassword = (password: string): string => {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
};

// Verify password against hash
export const verifyPassword = (password: string, hash: string): boolean => {
    return hashPassword(password) === hash;
};
