import { TME_LINK_PREFIX } from '../../../config';

export default function formatUsername(username: string, asAbsoluteLink?: boolean) {
  return asAbsoluteLink ? `${TME_LINK_PREFIX}${username}` : `@${username}`;
}
