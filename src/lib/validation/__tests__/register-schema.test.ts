import { registerSchema } from '@/lib/validation/register-schema';

describe('registerSchema', () => {
  const validData = {
    firstName: 'John',
    middleName: 'Michael',
    lastName: 'Doe',
    suffix: 'Jr.',
    email: 'john@example.com',
    password: 'password123',
    passwordConfirmation: 'password123',
  };

  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('John');
      expect(result.data.email).toBe('john@example.com');
    }
  });

  it('rejects empty first name', () => {
    const result = registerSchema.safeParse({ ...validData, firstName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.path[0]);
      expect(errors).toContain('firstName');
    }
  });

  it('rejects empty last name', () => {
    const result = registerSchema.safeParse({ ...validData, lastName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.path[0]);
      expect(errors).toContain('lastName');
    }
  });

  it('rejects empty email', () => {
    const result = registerSchema.safeParse({ ...validData, email: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.path[0]);
      expect(errors).toContain('email');
    }
  });

  it('rejects invalid email format', () => {
    const result = registerSchema.safeParse({ ...validData, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: '1234567',
      passwordConfirmation: '1234567',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordIssue = result.error.issues.find((i) => i.path[0] === 'password');
      expect(passwordIssue).toBeDefined();
    }
  });

  it('rejects mismatched password confirmation', () => {
    const result = registerSchema.safeParse({
      ...validData,
      passwordConfirmation: 'different',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmIssue = result.error.issues.find((i) => i.path[0] === 'passwordConfirmation');
      expect(confirmIssue).toBeDefined();
    }
  });

  it('accepts optional fields omitted (middleName, suffix)', () => {
    const { middleName, suffix, ...rest } = validData;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('rejects empty password confirmation', () => {
    const result = registerSchema.safeParse({ ...validData, passwordConfirmation: '' });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from string fields', () => {
    const result = registerSchema.safeParse({
      ...validData,
      firstName: '  John  ',
      email: '  john@example.com  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('John');
      expect(result.data.email).toBe('john@example.com');
    }
  });
});
