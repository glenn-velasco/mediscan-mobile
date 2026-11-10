import { login } from '@/api/endpoints/auth';
import { supabase } from '@/api/supabase';

jest.mock('@/api/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      getUser: jest.fn(),
      refreshSession: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
  throwSupabaseError: jest.fn((error) => { throw error; }),
}));

const authUser = {
  id: 'user-1',
  email: 'patient@example.com',
  email_confirmed_at: '2026-11-04T00:00:00Z',
  app_metadata: {},
};

const profile = {
  id: 'user-1',
  first_name: 'Pat',
  middle_name: null,
  last_name: 'Ient',
  suffix: null,
  dob: '1990-01-01',
  gender: 'female',
  address: { formatted: '123 Main Street' },
  phone_number: '+639171234567',
  phone_country_code: 'PH',
  is_active: true,
  is_professional: false,
  professional_verified_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
    data: { session: { access_token: 'token', user: authUser } },
    error: null,
  });
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: authUser }, error: null });
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table !== 'profiles') throw new Error(`Unexpected auth query: ${table}`);
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: profile, error: null }),
        })),
      })),
    };
  });
});

it('does not fabricate an incomplete medical record during login', async () => {
  const result = await login({
    email: 'patient@example.com',
    password: 'correct-password',
    device_name: 'Test device',
  });

  expect(result.user.medical_information).toBeNull();
  expect(result.user.fullname).toBe('Pat Ient');
  expect(supabase.from).toHaveBeenCalledTimes(1);
  expect(supabase.from).toHaveBeenCalledWith('profiles');
});
