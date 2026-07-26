import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Minimal expo-sqlite-shaped async wrapper over Node's built-in node:sqlite, for tests only.
 * expo-sqlite's native (JSI) binding isn't available under jest-expo's Node environment (see
 * sealed-box.service.test.ts), but every migration and repository in this codebase only ever
 * touches this narrow method surface (execAsync/runAsync/getFirstAsync/getAllAsync/withTransactionAsync)
 * — running the exact same SQL against a real SQLite engine here gives genuine coverage instead of
 * a hand-rolled mock that could pass against the wrong semantics.
 */
export function createNodeSqliteAdapter(): SQLiteDatabase {
  const db = new DatabaseSync(':memory:');

  function bind(params: unknown[]): unknown[] {
    return params.map((p) => (p === undefined ? null : p));
  }

  const adapter = {
    execAsync: async (sql: string): Promise<void> => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      const result = db.prepare(sql).run(...(bind(params) as never[]));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getFirstAsync: async <T>(sql: string, ...params: unknown[]): Promise<T | null> => {
      const row = db.prepare(sql).get(...(bind(params) as never[]));
      return (row ?? null) as T | null;
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
      const rows = db.prepare(sql).all(...(bind(params) as never[]));
      return rows as T[];
    },
    withTransactionAsync: async (callback: () => Promise<void>): Promise<void> => {
      db.exec('BEGIN');
      try {
        await callback();
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };

  return adapter as unknown as SQLiteDatabase;
}
