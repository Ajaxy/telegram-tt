import type { TeactNode } from '../../../lib/teact/teact';

import type { ApiPeer, ApiStarGiftAttributeOriginalDetails } from '../../../api/types';

import { getPeerTitle } from '../../../global/helpers/peers';
import { formatDateTimeToString } from '../../../util/dates/dateFormat';
import { type LangFn } from '../../../util/localization';
import { renderTextWithEntities } from './renderTextWithEntities';

import Link from '../../ui/Link';

type GiftOriginalInfoOptions = {
  originalDetails: ApiStarGiftAttributeOriginalDetails;
  recipient: ApiPeer;
  sender?: ApiPeer;
  onOpenChat: (peerId: string) => void;
  lang: LangFn;
};

export function renderGiftOriginalInfo({
  originalDetails,
  recipient,
  sender,
  onOpenChat,
  lang,
}: GiftOriginalInfoOptions): TeactNode | undefined {
  const { recipientId, senderId, date, message } = originalDetails;

  const formattedDate = formatDateTimeToString(date * 1000, lang.code, true);
  const recipientLink = (
    <Link onClick={() => onOpenChat(recipientId)} isPrimary>
      {getPeerTitle(lang, recipient)}
    </Link>
  );

  if (!sender || senderId === recipientId) {
    return message
      ? lang('GiftInfoPeerOriginalInfoText', {
        peer: recipientLink,
        text: renderTextWithEntities(message),
        date: formattedDate,
      }, {
        withNodes: true,
      })
      : lang('GiftInfoPeerOriginalInfo', {
        peer: recipientLink,
        date: formattedDate,
      }, {
        withNodes: true,
      });
  }

  const senderLink = (
    <Link onClick={() => onOpenChat(sender.id)} isPrimary>
      {getPeerTitle(lang, sender)}
    </Link>
  );

  return message
    ? lang('GiftInfoPeerOriginalInfoTextSender', {
      peer: recipientLink,
      sender: senderLink,
      text: renderTextWithEntities(message),
      date: formattedDate,
    }, {
      withNodes: true,
    })
    : lang('GiftInfoPeerOriginalInfoSender', {
      peer: recipientLink,
      date: formattedDate,
      sender: senderLink,
    }, {
      withNodes: true,
    });
}
