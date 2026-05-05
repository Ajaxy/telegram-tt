export type PrimitiveRecordValue = string | number | boolean;
export type PrimitiveRecord = Record<string, PrimitiveRecordValue>;

export function sanitizePrimitiveRecord(data?: Record<string, unknown>) {
  const result: PrimitiveRecord = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
  });

  return Object.keys(result).length ? result : undefined;
}
