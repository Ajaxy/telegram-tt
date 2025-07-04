import { getAccountSlotUrl } from '../../../util/multiaccount';

export function navigateBack() {
  const currentUrl = new URL(window.location.href);
  const referrer = document.referrer ? new URL(document.referrer) : undefined;
  if (referrer?.origin === currentUrl.origin && referrer.pathname === currentUrl.pathname
    && referrer.searchParams.get('account') !== currentUrl.searchParams.get('account')) {
    window.location.assign(referrer); // Return to previous account with it's state
    return;
  }

  const url = getAccountSlotUrl(1);
  window.location.href = url;
}
