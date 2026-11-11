import type { ApiWidgetWalletAnswer } from '../api/types';

// What the widget's promise settles with: the bot's answer, or the wallet call's failure (widget-sandbox sdk-v1 §2.18)
export type WidgetWalletOutcome = ApiWidgetWalletAnswer | { error: 'REJECTED' | 'BAD_REQUEST' };

// The promise of a wallet call lives with its widget, while its window lives in the global state
const pendingCalls = new Map<string, (outcome: WidgetWalletOutcome) => void>();
let lastCallId = 0;

export function registerWidgetWalletCall(settle: (outcome: WidgetWalletOutcome) => void) {
  const callId = String(++lastCallId);
  pendingCalls.set(callId, settle);

  return callId;
}

// Only the first outcome counts: a window closed after its answer settles nothing
export function settleWidgetWalletCall(callId: string, outcome: WidgetWalletOutcome) {
  const settle = pendingCalls.get(callId);
  if (!settle) return;

  pendingCalls.delete(callId);
  settle(outcome);
}
