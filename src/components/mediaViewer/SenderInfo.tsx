import type { FC } from '../../lib/teact/teact';
import React, { useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiPeer } from '../../api/types';
import type { MediaViewerItem } from './helpers/getViewableMedia';

import {
  getSenderTitle, isChatChannel, isChatGroup, isUserId,
} from '../../global/helpers';
import {
  selectSender,
} from '../../global/selectors';
import { formatMediaDateTime } from '../../util/dates/dateFormat';
import renderText from '../common/helpers/renderText';

import useAppLayout from '../../hooks/useAppLayout';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Avatar from '../common/Avatar';

import './SenderInfo.scss';

type OwnProps = {
  item?: MediaViewerItem;
};

type StateProps = {
  owner?: ApiPeer;
};

const BULLET = '\u2022';
const ANIMATION_DURATION = 350;

const SenderInfo: FC<OwnProps & StateProps> = ({
  owner,
  item,
}) => {
  const {
    closeMediaViewer,
    focusMessage,
    toggleChatInfo,
  } = getActions();

  const { isMobile } = useAppLayout();

  const handleFocusMessage = useLastCallback(() => {
    closeMediaViewer();

    if (item?.type !== 'message') return;

    const message = item.message;

    if (isMobile) {
      setTimeout(() => {
        toggleChatInfo({ force: false }, { forceSyncOnIOs: true });
        focusMessage({ chatId: message.chatId, messageId: message.id });
      }, ANIMATION_DURATION);
    } else {
      focusMessage({ chatId: message.chatId, messageId: message.id });
    }
  });

  const lang = useOldLang();

  const subtitle = useMemo(() => {
    if (!item || item.type === 'standalone') return undefined;

    const avatarOwner = item.type === 'avatar' ? item.avatarOwner : undefined;
    const avatar = avatarOwner?.profilePhotos?.photos[item.mediaIndex!];
    const isFallbackAvatar = avatar?.id === avatarOwner?.profilePhotos?.fallbackPhoto?.id;
    const date = item.type === 'message' ? item.message.date : avatar?.date;
    if (!date) return undefined;

    const formattedDate = formatMediaDateTime(lang, date * 1000, true);
    const count = avatarOwner?.profilePhotos?.count
      && (avatarOwner.profilePhotos.count + (avatarOwner?.profilePhotos?.fallbackPhoto ? 1 : 0));
    const countText = count && lang('Of', [item.mediaIndex! + 1, count]);

    const parts: string[] = [];
    if (avatar) {
      const chat = !isUserId(avatarOwner!.id) ? avatarOwner as ApiChat : undefined;
      const isChannel = chat && isChatChannel(chat);
      const isGroup = chat && isChatGroup(chat);
      parts.push(lang(
        isFallbackAvatar ? 'lng_mediaview_profile_public_photo'
          : isChannel ? 'lng_mediaview_channel_photo'
            : isGroup ? 'lng_mediaview_group_photo' : 'lng_mediaview_profile_photo',
      ));
    }

    if (countText) parts.push(countText);

    parts.push(formattedDate);

    return parts.join(` ${BULLET} `);
  }, [item, lang]);

  if (!owner) {
    return undefined;
  }

  const senderTitle = getSenderTitle(lang, owner);

  return (
    <div className="SenderInfo" onClick={handleFocusMessage}>
      <Avatar key={owner.id} size="medium" peer={owner} />
      <div className="meta">
        <div className="title" dir="auto">
          {senderTitle && renderText(senderTitle)}
        </div>
        <div className="date" dir="auto">
          {subtitle}
        </div>
      </div>
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global, { item }): StateProps => {
    const message = item?.type === 'message' ? item.message : undefined;
    const messageSender = message && selectSender(global, message);

    const owner = item?.type === 'avatar' ? item.avatarOwner : messageSender;

    return {
      owner,
    };
  },
)(SenderInfo);
