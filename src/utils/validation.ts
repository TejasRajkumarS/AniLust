// Validation utilities for forms

export interface ValidationResult {
    isValid: boolean;
    message?: string;
}

// Email validation
export const validateEmail = (email: string): ValidationResult => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
        return { isValid: false, message: 'Email is required' };
    }

    if (!emailRegex.test(email)) {
        return { isValid: false, message: 'Please enter a valid email address' };
    }

    return { isValid: true };
};

// Username validation
export const validateUsername = (username: string): ValidationResult => {
    if (!username) {
        return { isValid: false, message: 'Username is required' };
    }

    if (username.length < 3) {
        return { isValid: false, message: 'Username must be at least 3 characters' };
    }

    if (username.length > 20) {
        return { isValid: false, message: 'Username must be less than 20 characters' };
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
        return { isValid: false, message: 'Username can only contain letters, numbers, and underscores' };
    }

    return { isValid: true };
};

// Password validation
export const validatePassword = (password: string): ValidationResult => {
    if (!password) {
        return { isValid: false, message: 'Password is required' };
    }

    if (password.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters' };
    }

    if (!/[A-Z]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one number' };
    }

    return { isValid: true };
};

// Password strength checker
export const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
};

// Confirm password validation
export const validateConfirmPassword = (password: string, confirmPassword: string): ValidationResult => {
    if (!confirmPassword) {
        return { isValid: false, message: 'Please confirm your password' };
    }

    if (password !== confirmPassword) {
        return { isValid: false, message: 'Passwords do not match' };
    }

    return { isValid: true };
};
