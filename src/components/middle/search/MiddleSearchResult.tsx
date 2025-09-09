import { memo } from '../../../lib/teact/teact';

import type { ApiChat, ApiMessage, ApiPeer } from '../../../api/types';

import { getMessageSenderName } from '../../../global/helpers/peers';
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
  message: ApiMessage;
  senderPeer?: ApiPeer;
  messageChat?: ApiChat;
  shouldShowChat?: boolean;
  query?: string;
  className?: string;
  onClick: (message: ApiMessage) => void;
};

const TRUNCATE_LENGTH = 200;

const MiddleSearchResult = ({
  isActive,
  message,
  senderPeer,
  messageChat,
  shouldShowChat,
  query,
  className,
  onClick,
}: OwnProps) => {
  const lang = useLang();
  const hiddenForwardTitle = message.forwardInfo?.hiddenUserName;

  const peer = shouldShowChat ? messageChat : senderPeer;

  const senderName = shouldShowChat && senderPeer ? getMessageSenderName(lang, message.chatId, senderPeer) : undefined;

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
        peer={peer}
        text={hiddenForwardTitle}
        size="medium"
      />
      <div className={styles.info}>
        <div className={styles.topRow}>
          {(peer && <FullNameTitle peer={peer} withEmojiStatus />) || hiddenForwardTitle}
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
