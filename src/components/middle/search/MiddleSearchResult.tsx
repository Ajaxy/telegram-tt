import { memo } from '../../../lib/teact/teact';

import type { ApiChat, ApiMessage, ApiPeer } from '../../../api/types';

import { getGroupStatus, getMainUsername } from '../../../global/helpers';
import { getMessageSenderName, isApiPeerChat } from '../../../global/helpers/peers';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import LastMessageMeta from '../../common/LastMessageMeta';
import MessageSummary from '../../common/MessageSummary';

import styles from './MiddleSearchResult.module.scss';

type OwnProps = {
  isActive?: boolean;
  message?: ApiMessage;
  peer?: ApiPeer;
  messageChat?: ApiChat;
  shouldShowChat?: boolean;
  query?: string;
  className?: string;
  onClick: (clickArg: any) => void;
};

const TRUNCATE_LENGTH = 200;

const MiddleSearchResult = ({
  isActive,
  message,
  peer,
  messageChat,
  shouldShowChat,
  query,
  className,
  onClick,
}: OwnProps) => {
  const lang = useLang();

  if (peer && !message) {
    const username = getMainUsername(peer);

    const handlePeerClick = () => {
      onClick(peer.id);
    };

    return (
      <div
        role="button"
        tabIndex={0}
        className={buildClassName(styles.root, isActive && styles.active, className)}
        onClick={handlePeerClick}
      >
        <Avatar
          className={styles.avatar}
          peer={peer}
          size="medium"
        />
        <div className={styles.info}>
          <div className={styles.topRow}>
            <FullNameTitle peer={peer} withEmojiStatus />
          </div>
          {(isApiPeerChat(peer) || username) && (
            <div className={styles.subtitle} dir="auto">
              {username
                ? `@${username}`
                : getGroupStatus(lang, peer as ApiChat)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!message) return undefined;

  const hiddenForwardTitle = message.forwardInfo?.hiddenUserName;
  const senderPeer = shouldShowChat ? messageChat : peer;
  const senderName = shouldShowChat && peer ? getMessageSenderName(lang, message.chatId, peer) : undefined;

  const handleClick = useLastCallback(() => {
    onClick(message);
  });

  return (
    <div
      role="button"
      tabIndex={0}
      className={buildClassName(styles.root, isActive && styles.active, className)}
      onClick={handleClick}
    >
      <Avatar
        className={styles.avatar}
        peer={senderPeer}
        text={hiddenForwardTitle}
        size="medium"
      />
      <div className={styles.info}>
        <div className={styles.topRow}>
          {(senderPeer && <FullNameTitle peer={senderPeer} withEmojiStatus />) || hiddenForwardTitle}
          <LastMessageMeta className={styles.meta} message={message} />
        </div>
        <div className={styles.subtitle} dir="auto">
          {senderName && (
            <>
              <span className="sender-name">{renderText(senderName)}</span>
              <span className="colon">:</span>
            </>
          )}
          <MessageSummary message={message} highlight={query} truncateLength={TRUNCATE_LENGTH} />
        </div>
      </div>
    </div>
  );
};

export default memo(MiddleSearchResult);
