import type { Api } from '../tl';

import Deferred from '../../../util/Deferred';

export type CallableRequest = Api.AnyRequest | Api.MsgsAck | Api.MsgsStateReq
  | Api.MsgsStateInfo | Api.MsgResendReq | Api.HttpWait;
type RequestResponse<T> = T extends { __response: infer R } ? R : void;

export default class RequestState<T extends CallableRequest = CallableRequest> {
  public containerId?: bigint;

  public msgId?: bigint;

  public seqNo?: number;

  public containerSeqNo?: number;

  public acknowledgedMsgIds?: bigint[];

  public request: any;

  public data: Uint8Array;

  public after: any;

  public result: undefined;

  public finished: Deferred;

  public promise: Promise<RequestResponse<T> | undefined> | undefined;

  public abortSignal: AbortSignal | undefined;

  public resolve?: (value?: RequestResponse<T>) => void;

  public reject?: (reason?: Error) => void;

  constructor(request: T, abortSignal?: AbortSignal) {
    this.containerId = undefined;
    this.msgId = undefined;
    this.seqNo = undefined;
    this.containerSeqNo = undefined;
    this.acknowledgedMsgIds = undefined;
    this.request = request;
    this.data = request.getBytes();
    this.after = undefined;
    this.result = undefined;
    this.abortSignal = abortSignal;
    this.finished = new Deferred();

    this.resetPromise();
  }

  isReady() {
    if (!this.after) {
      return true;
    }

    return this.after.finished.promise;
  }

  get isContentRelated() {
    return this.request.classType === 'request'
      || this.request.className === 'MsgsStateReq'
      || this.request.className === 'MsgResendReq';
  }

  resetPromise() {
    // Prevent stuck await
    this.reject?.();

    this.promise = new Promise<RequestResponse<T> | undefined>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
