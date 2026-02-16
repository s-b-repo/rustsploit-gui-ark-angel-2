import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 12;

export interface PasswordValidation {
    valid: boolean;
    errors: string[];
}

/**
 * Validate password complexity.
 * Requirements:
 *  - Minimum 12 characters
 *  - At least 1 uppercase letter
 *  - At least 1 lowercase letter
 *  - At least 1 digit
 *  - At least 1 special character
 */
export function validatePasswordComplexity(password: string): PasswordValidation {
    const errors: string[] = [];

    if (password.length < MIN_LENGTH) {
        errors.push(`Password must be at least ${MIN_LENGTH} characters`);
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one digit');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
}

export function hashPassword(password: string): string {
    return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
}

/**
 * Get password complexity rules for display in the UI
 */
export function getComplexityRules(): string[] {
    return [
        `Minimum ${MIN_LENGTH} characters`,
        'At least one uppercase letter (A-Z)',
        'At least one lowercase letter (a-z)',
        'At least one digit (0-9)',
        'At least one special character (!@#$%^&*...)',
    ];
}
