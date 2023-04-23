import { DEBUG_MORE } from '../config';
import { handleError } from './handleError';

const SAFE_EXEC_ENABLED = !DEBUG_MORE;

export default function safeExec(cb: Function, rescue?: (err: Error) => void, always?: NoneToVoidFunction) {
  if (!SAFE_EXEC_ENABLED) {
    return cb();
  }

  try {
    return cb();
  } catch (err: any) {
    rescue?.(err);
    handleError(err);
    return undefined;
  } finally {
    always?.();
  }
}
