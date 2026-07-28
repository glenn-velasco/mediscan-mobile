import type { Resolver, FieldValues } from 'react-hook-form';
import type { z } from 'zod';

export function zodResolver<T extends z.ZodType<FieldValues>>(schema: T): Resolver<z.infer<T>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, any> = {};
    for (const issue of result.error.issues) {
      const parts = issue.path.map(String);
      if (parts.length === 0) continue;
      let cur: Record<string, any> = errors;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]].message === 'string') cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      const leaf = parts[parts.length - 1];
      if (!cur[leaf]) cur[leaf] = { message: issue.message, type: issue.code };
    }
    return { values: {}, errors };
  };
}
