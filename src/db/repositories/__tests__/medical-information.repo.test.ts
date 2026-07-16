import { setCurrentUserId } from '@/db/context';
import { runMigrations } from '@/db/migrations';
import { createNodeSqliteAdapter } from '@/db/test-utils/node-sqlite-adapter';

import { getDb } from '@/db/client';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import type { MedicalInformationPayload } from '@/api/types';

jest.mock('@/db/client', () => ({ getDb: jest.fn() }));

beforeEach(async () => {
  const db = createNodeSqliteAdapter();
  await runMigrations(db);
  (getDb as jest.Mock).mockResolvedValue(db);
  setCurrentUserId(0);
});

const basePayload: MedicalInformationPayload = {
  email: 'patient@example.com',
  first_name: 'John',
  middle_name: 'David',
  last_name: 'Smith',
  suffix: 'Jr.',
  date_of_birth: '1990-01-15',
  gender: 'Male',
  phone_country_code: 'PH',
  phone: '9171234567',
  blood_type: 'O+',
  religion: 'Catholic',
  address: '123 Main St',
  no_blood_transfusion: false,
};

describe('medical-information.repo — applyProfessionalUpdate', () => {
  it('patches only the provided fields, preserving everything else', async () => {
    await medicalInformationRepo.saveLocalEdit(basePayload);
    await medicalInformationRepo.applyProfessionalUpdate({ blood_type: 'A+', no_blood_transfusion: true });

    const row = await medicalInformationRepo.getLocal();
    expect(row).toMatchObject({
      first_name: 'John',
      last_name: 'Smith',
      blood_type: 'A+',
      no_blood_transfusion: 1,
      phone: '9171234567',
      address: '123 Main St',
    });
  });

  it('recomputes full_name when first_name changes', async () => {
    await medicalInformationRepo.saveLocalEdit(basePayload);
    await medicalInformationRepo.applyProfessionalUpdate({ first_name: 'Jane' });

    const row = await medicalInformationRepo.getLocal();
    expect(row?.full_name).toBe('Jane David Smith Jr.');
  });

  it('recomputes full_name when middle_name or suffix changes', async () => {
    await medicalInformationRepo.saveLocalEdit(basePayload);
    await medicalInformationRepo.applyProfessionalUpdate({ middle_name: null, suffix: null });

    const row = await medicalInformationRepo.getLocal();
    expect(row?.full_name).toBe('John Smith');
  });

  it('does not recompute full_name when only non-name fields change', async () => {
    await medicalInformationRepo.saveLocalEdit(basePayload);
    const original = await medicalInformationRepo.getLocal();
    await medicalInformationRepo.applyProfessionalUpdate({ blood_type: 'B-' });

    const row = await medicalInformationRepo.getLocal();
    expect(row?.full_name).toBe(original?.full_name);
  });

  it('works when no existing row exists (starts from defaults)', async () => {
    await medicalInformationRepo.applyProfessionalUpdate({ first_name: 'Alice', last_name: 'Wong', blood_type: 'AB+' });

    const row = await medicalInformationRepo.getLocal();
    expect(row).toMatchObject({
      first_name: 'Alice',
      last_name: 'Wong',
      blood_type: 'AB+',
      middle_name: null,
      gender: null,
      no_blood_transfusion: 0,
    });
    expect(row?.full_name).toBe('Alice Wong');
  });

  it('accumulates changes across multiple sequential patches', async () => {
    await medicalInformationRepo.saveLocalEdit(basePayload);
    await medicalInformationRepo.applyProfessionalUpdate({ blood_type: 'A-' });
    await medicalInformationRepo.applyProfessionalUpdate({ gender: 'Female', address: '456 Oak Ave' });

    const row = await medicalInformationRepo.getLocal();
    expect(row).toMatchObject({
      blood_type: 'A-',
      gender: 'Female',
      address: '456 Oak Ave',
      first_name: 'John',
      phone: '9171234567',
    });
  });

  it('preserves the email from the existing row', async () => {
    await medicalInformationRepo.saveLocalEdit(basePayload);
    await medicalInformationRepo.applyProfessionalUpdate({ blood_type: 'O-' });

    const row = await medicalInformationRepo.getLocal();
    expect(row?.email).toBe('patient@example.com');
  });

  it('sets sync_status to synced', async () => {
    await medicalInformationRepo.saveLocalEdit(basePayload, 'pending');
    await medicalInformationRepo.applyProfessionalUpdate({ blood_type: 'O-' });

    const row = await medicalInformationRepo.getLocal();
    expect(row?.sync_status).toBe('synced');
  });
});
