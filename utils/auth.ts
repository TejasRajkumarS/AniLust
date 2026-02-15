// Authentication utilities

// Simple hash function for demo purposes
// In production, use bcrypt or similar
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

// Generate a simple salt (for demo)
export const generateSalt = (): string => {
    return Math.random().toString(36).substring(2, 15);
};

// Hash password with salt
export const hashPasswordWithSalt = (password: string, salt: string): string => {
    return hashPassword(password + salt);
};
