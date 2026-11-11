import { memo, useEffect, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiSendAsPeerId } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import { isApiPeerUser } from '../../../global/helpers/peers';
import { selectPeer } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import { useShallowSelector } from '../../../hooks/data/useSelector';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Icon from '../../common/icons/Icon';
import ListItem from '../../ui/ListItem';
import Menu from '../../ui/Menu';

import './SendAsMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  chatId?: string;
  selectedSendAsId?: string;
  sendAsPeerIds?: ApiSendAsPeerId[];
  isCurrentUserPremium?: boolean;
  onClose: () => void;
};

const SendAsMenu = ({
  isOpen,
  chatId,
  selectedSendAsId,
  sendAsPeerIds,
  isCurrentUserPremium,
  onClose,
}: OwnProps) => {
  const { saveDefaultSendAs, showNotification, loadSendAs } = getActions();

  const peersSelector = useMemo(() => (global: GlobalState) => (
    sendAsPeerIds?.map(({ id }) => selectPeer(global, id))
  ), [sendAsPeerIds]);
  const peers = useShallowSelector(peersSelector);
  const hasMissingPeers = Boolean(peers?.some((peer) => !peer));

  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>();

  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(isOpen, onClose, undefined);

  useEffect(() => {
    if (isOpen) {
      markMouseInside();
    }
  }, [isOpen, markMouseInside]);

  const handleUserSelect = useLastCallback((id: string) => {
    onClose();
    saveDefaultSendAs({ chatId: chatId!, sendAsId: id });
  });

  const selectedSendAsIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: sendAsPeerIds,
    onSelect: handleUserSelect,
    shouldSelectOnTab: true,
    shouldSaveSelectionOnUpdateItems: true,
    onClose,
  });

  useEffect(() => {
    containerRef.current?.querySelector<HTMLElement>('.focus')?.scrollIntoView({ block: 'nearest' });
  }, [selectedSendAsIndex]);

  // Cached `sendAsPeerIds` can outlive the cached peers they point to
  useEffect(() => {
    if (isOpen && chatId && hasMissingPeers) {
      loadSendAs({ chatId });
    }
  }, [isOpen, chatId, hasMissingPeers]);

  useEffect(() => {
    if (sendAsPeerIds && !sendAsPeerIds.length) {
      onClose();
    }
  }, [sendAsPeerIds, onClose]);

  return (
    <Menu
      ref={containerRef}
      isOpen={isOpen}
      positionX="left"
      positionY="bottom"
      onClose={onClose}
      className="SendAsMenu"
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
      noCompact
    >
      <div className="send-as-title" dir="auto">{lang('SendMessageAsTitle')}</div>
      {sendAsPeerIds?.map(({ id, isPremium }, index) => {
        const peer = peers?.[index];
        if (!peer) return undefined;

        const handleClick = () => {
          if (!isPremium || isCurrentUserPremium) {
            handleUserSelect(id);
          } else {
            showNotification({
              message: {
                key: 'SelectSendAsPeerPremiumHint',
                options: { withNodes: true, withMarkdown: true, renderTextFilters: ['br', 'links'] },
              },
              actionText: { key: 'Open' },
              action: {
                action: 'openPremiumModal',
                payload: {},
              },
            });
          }
        };

        const avatarClassName = buildClassName(selectedSendAsId === id && 'selected');

        return (
          <ListItem
            key={id}
            className="SendAsItem chat-item-clickable scroll-item with-avatar"

            onClick={handleClick}
            focus={selectedSendAsIndex === index}
            rightElement={!isCurrentUserPremium && isPremium
              && <Icon name="lock-filled" className="send-as-icon-locked" />}
          >
            <Avatar
              size="small"
              peer={peer}
              className={avatarClassName}
            />
            <div className="info">
              <FullNameTitle peer={peer} noFake />
              <span className="subtitle">
                {isApiPeerUser(peer)
                  ? lang('VoipGroupPersonalAccount')
                  : lang('Subscribers', { count: peer.membersCount || 0 }, { pluralValue: peer.membersCount || 0 })}
              </span>
            </div>
          </ListItem>
        );
      })}
    </Menu>
  );
};

export default memo(SendAsMenu);
