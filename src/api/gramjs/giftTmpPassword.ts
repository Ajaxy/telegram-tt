import { getServerTime } from '../../util/serverTime';

// Seconds. A password this close to its expiry could lapse on the way to the server, as the iOS app also assumes.
const EXPIRY_MARGIN = 5;

// Kept in the worker that all tabs share, so the next gift within the period does not ask for the password again
let giftTmpPassword: { value: Uint8Array<ArrayBuffer>; validUntil: number } | undefined;

export function getGiftTmpPassword() {
  if (giftTmpPassword && giftTmpPassword.validUntil - EXPIRY_MARGIN <= getServerTime()) {
    giftTmpPassword = undefined;
  }

  return giftTmpPassword?.value;
}

export function storeGiftTmpPassword(value: Uint8Array<ArrayBuffer>, validUntil: number) {
  giftTmpPassword = { value, validUntil };
}

export function resetGiftTmpPassword() {
  giftTmpPassword = undefined;
}
