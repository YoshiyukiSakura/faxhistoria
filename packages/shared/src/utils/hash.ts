import { createHash } from 'crypto';

export function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
  return createHash('sha256').update(str).digest('hex');
}
