import { IS_IOS, IS_SAFARI } from '../util/environment';
import { initializeSoundsForSafari } from '../global/actions/ui/calls';

export { default as GroupCall } from '../components/calls/group/GroupCall';
export { default as ActiveCallHeader } from '../components/calls/ActiveCallHeader';
export { default as PhoneCall } from '../components/calls/phone/PhoneCall';
export { default as RatePhoneCallModal } from '../components/calls/phone/RatePhoneCallModal';

if (IS_SAFARI || IS_IOS) {
  document.addEventListener('click', initializeSoundsForSafari, { once: true });
}
