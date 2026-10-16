import { memo, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiMessage, ApiMessagePoll, ApiPeer } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThemeKey } from '../../types';
import type { MenuItemContextAction } from '../ui/ListItem';

import { getPeerTitle } from '../../global/helpers/peers';
import { selectPollFromMessage, selectSender } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatCompactTimestamp, secondsToDate } from '../../util/localization/dateFormat';
import renderText from './helpers/renderText';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePeerColor from '../../hooks/usePeerColor';

import Island from '../gili/layout/Island';
import Poll from '../middle/message/poll/Poll';
import Link from '../ui/Link';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';

import styles from './ProfilePoll.module.scss';

type OwnProps = {
  message: ApiMessage;
  theme: ThemeKey;
  observeIntersection?: ObserveFn;
  contextActions?: MenuItemContextAction[];
  onDateClick: (message: ApiMessage) => void;
};

type StateProps = {
  poll?: ApiMessagePoll;
  sender?: ApiPeer;
};

const ProfilePoll = ({
  message, theme, observeIntersection, poll, sender, contextActions, onDateClick,
}: OwnProps & StateProps) => {
  const ref = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();

  const lang = useLang();

  const { className: peerColorClass, style: peerColorStyle } = usePeerColor({ peer: sender, theme });

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, !contextActions, true);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!.closest('.custom-scroll') || document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleDateClick = useLastCallback(() => {
    onDateClick(message);
  });

  if (!poll) return undefined;

  const senderTitle = sender && getPeerTitle(lang, sender);

  return (
    <Island
      ref={ref}
      className={buildClassName(styles.root, 'scroll-item', peerColorClass, contextMenuAnchor && styles.hasMenuOpen)}
      style={peerColorStyle}
      dir={lang.isRtl ? 'rtl' : undefined}
      onMouseDown={handleBeforeContextMenu}
      onContextMenu={contextActions ? handleContextMenu : undefined}
    >
      <div className={styles.header}>
        {senderTitle && (
          <div className={styles.sender}>
            {renderText(senderTitle)}
          </div>
        )}
        <Link className={styles.date} isRtl={lang.isRtl} onClick={handleDateClick}>
          {formatCompactTimestamp(lang, secondsToDate(message.date))}
        </Link>
      </div>
      <Poll
        chatId={message.chatId}
        messageId={message.id}
        poll={poll}
        messageText={message.content.text}
        theme={theme}
        observeIntersectionForLoading={observeIntersection}
        observeIntersectionForPlaying={observeIntersection}
      />
      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          ref={menuRef}
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="shared-media-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </Island>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    return {
      poll: selectPollFromMessage(global, message),
      sender: selectSender(global, message),
    };
  },
)(ProfilePoll));
