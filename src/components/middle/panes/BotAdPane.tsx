import React, { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSponsoredMessage } from '../../../api/types';
import type { MessageListType } from '../../../types';

import { selectBot, selectSponsoredMessage } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getApiPeerColorClass } from '../../common/helpers/peerColor';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import Avatar from '../../common/Avatar';
import BadgeButton from '../../common/BadgeButton';
import SponsoredMessageContextMenuContainer from '../message/SponsoredMessageContextMenuContainer';

import styles from './BotAdPane.module.scss';

type OwnProps = {
  chatId: string;
  messageListType: MessageListType;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  isBot?: boolean;
  sponsoredMessage?: ApiSponsoredMessage;
};

const BotAdPane = ({
  chatId,
  isBot,
  messageListType,
  sponsoredMessage,
  onPaneStateChange,
}: OwnProps & StateProps) => {
  const {
    viewSponsoredMessage,
    openUrl,
    clickSponsoredMessage,
    openAboutAdsModal,
  } = getActions();

  const lang = useLang();

  const isOpen = Boolean(isBot && sponsoredMessage && messageListType === 'thread');

  const renderingSponsoredMessage = useCurrentOrPrev(sponsoredMessage);

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    withResizeObserver: true,
    onStateChange: onPaneStateChange,
  });

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, !shouldRender, true);

  const handleClick = useLastCallback(() => {
    if (!renderingSponsoredMessage) return;

    clickSponsoredMessage({ peerId: chatId });
    openUrl({ url: renderingSponsoredMessage.url, shouldSkipModal: true });
  });

  const handleAboutClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    openAboutAdsModal({ chatId });
  });

  useEffect(() => {
    if (shouldRender && sponsoredMessage) {
      viewSponsoredMessage({ peerId: chatId });
    }
  }, [shouldRender, sponsoredMessage, chatId]);

  if (!shouldRender || !renderingSponsoredMessage) {
    return undefined;
  }

  const {
    peerColor,
    content,
    photo,
    title,
  } = renderingSponsoredMessage;

  return (
    <>
      <div
        ref={ref}
        className={styles.root}
        onClick={handleClick}
        onMouseDown={handleBeforeContextMenu}
        onContextMenu={handleContextMenu}
      >
        <div className={buildClassName(styles.content, peerColor && getApiPeerColorClass(peerColor))}>
          <span className={styles.info}>
            {lang('SponsoredMessageAd')}
            <BadgeButton onClick={handleAboutClick} className={styles.aboutAd}>
              {lang('SponsoredMessageAdWhatIsThis')}
            </BadgeButton>
          </span>
          <div className={styles.title}>{title}</div>
          {content.text && (
            <div className={styles.text}>
              {renderTextWithEntities({
                text: content.text.text,
                entities: content.text.entities,
              })}
            </div>
          )}
        </div>
        {photo && (
          <Avatar
            size="large"
            photo={photo}
            className={styles.avatar}
          />
        )}
      </div>
      {contextMenuAnchor && (
        <SponsoredMessageContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          triggerRef={ref}
          message={renderingSponsoredMessage}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const bot = selectBot(global, chatId);
    const sponsoredMessage = selectSponsoredMessage(global, chatId);
    return {
      isBot: Boolean(bot),
      sponsoredMessage,
    };
  },
)(BotAdPane));
