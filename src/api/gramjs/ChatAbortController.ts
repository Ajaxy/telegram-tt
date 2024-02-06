import type { ThreadId } from '../../types';

export class ChatAbortController extends AbortController {
  private threads = new Map<ThreadId, AbortController>();

  public getThreadSignal(threadId: ThreadId): AbortSignal {
    let controller = this.threads.get(threadId);
    if (!controller) {
      controller = new AbortController();
      this.threads.set(threadId, controller);
    }
    return controller.signal;
  }

  public abortThread(threadId: ThreadId, reason?: string): void {
    this.threads.get(threadId)?.abort(reason);
    this.threads.delete(threadId);
  }

  public abort(reason?: string): void {
    super.abort(reason);
    this.threads.forEach((controller) => controller.abort(reason));
    this.threads.clear();
  }
}
