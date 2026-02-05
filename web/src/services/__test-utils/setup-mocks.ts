/**
 * Vitest Mock Setup Helper - Automation Tests
 * This file helps set up all necessary mocks for automation tests
 */

export function createSupabaseStoreMock() {
  const store = new Map<string, any[]>();

  return {
    from: (table: string) => {
      if (!store.has(table)) store.set(table, []);
      const tableStore = store.get(table)!;

      return {
        insert: (data: any) => ({
          select: () => ({
            single: async () => ({
              data: {
                id: `${table}-${Date.now()}`,
                ...data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),

        select: (columns?: string) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              gte: (col3: string, val3: any) => ({
                then: async (cb: any) => {
                  const results = tableStore.filter(
                    (r) => r[col1] === val1 && r[col2] === val2 && r[col3] >= val3
                  );
                  return cb({ data: results, error: null });
                },
              }),
              single: async () => {
                const result = tableStore.find((r) => r[col1] === val1 && r[col2] === val2);
                return { data: result || null, error: null };
              },
              then: async (cb: any) => {
                const results = tableStore.filter((r) => r[col1] === val1 && r[col2] === val2);
                return cb({ data: results, error: null });
              },
            }),
            single: async () => {
              const result = tableStore.find((r) => r[col1] === val1);
              return { data: result || null, error: null };
            },
            gte: (col: string, val: any) => ({
              then: async (cb: any) => {
                const results = tableStore.filter((r) => r[col1] === val1 && r[col] >= val);
                return cb({ data: results, error: null });
              },
            }),
            then: async (cb: any) => {
              const results = tableStore.filter((r) => r[col1] === val1);
              return cb({ data: results, error: null });
            },
          }),
          gte: (col: string, val: any) => ({
            then: async (cb: any) => {
              const results = tableStore.filter((r) => r[col1] === val1 && r[col] >= val);
              return cb({ data: results, error: null });
            },
          }),
          then: async (cb: any) => {
            const results = tableStore.filter((r) => r[col1] === val1);
            return cb({ data: results, error: null });
          },
        }),

        update: (data: any) => ({
          eq: (col: string, val: any) => ({
            then: async (cb: any) => {
              const index = tableStore.findIndex((r) => r[col] === val);
              if (index !== -1) {
                tableStore[index] = { ...tableStore[index], ...data };
              }
              return cb({ data: null, error: null });
            },
          }),
        }),

        delete: () => ({
          eq: (col: string, val: any) => ({
            then: async (cb: any) => {
              const index = tableStore.findIndex((r) => r[col] === val);
              if (index !== -1) {
                tableStore.splice(index, 1);
              }
              return cb({ data: null, error: null });
            },
          }),
        }),
      };
    },
  };
}
