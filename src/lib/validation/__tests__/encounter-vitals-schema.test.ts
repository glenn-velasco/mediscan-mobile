import { encounterVitalsSchema } from '../encounter-vitals-schema';

const empty = { blood_pressure: '', heart_rate: '', respiratory_rate: '', temperature: '', oxygen_saturation: '' };

describe('encounter vitals validation', () => {
  it('accepts omitted readings and ordinary measurements', () => {
    expect(encounterVitalsSchema.safeParse(empty).success).toBe(true);
    expect(encounterVitalsSchema.safeParse({ blood_pressure: '120/80', heart_rate: '72', respiratory_rate: '16', temperature: '36.7', oxygen_saturation: '98' }).success).toBe(true);
  });

  it.each([
    ['blood_pressure', '58/150'],
    ['heart_rate', '999'],
    ['respiratory_rate', '0'],
    ['temperature', '99.9'],
    ['oxygen_saturation', '120'],
  ] as const)('rejects invalid %s', (kind, value) => {
    expect(encounterVitalsSchema.safeParse({ ...empty, [kind]: value }).success).toBe(false);
  });
});
