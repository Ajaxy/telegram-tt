export class ChatAbortController extends AbortController {
  private threads = new Map<number, AbortController>();

  public getThreadSignal(threadId: number): AbortSignal {
    let controller = this.threads.get(threadId);
    if (!controller) {
      controller = new AbortController();
      this.threads.set(threadId, controller);
    }
    return controller.signal;
  }

  public abortThread(threadId: number, reason?: string): void {
    this.threads.get(threadId)?.abort(reason);
    this.threads.delete(threadId);
  }

  public abort(reason?: string): void {
    super.abort(reason);
    this.threads.forEach((controller) => controller.abort(reason));
    this.threads.clear();
  }
}
