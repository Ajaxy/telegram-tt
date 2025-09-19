import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiMessage, ApiPaidReactionPrivacyType,
  ApiPeer,
  ApiSendAsPeerId,
  ApiStarsAmount, ApiUser,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { CustomPeer } from '../../../types';

import { STARS_ICON_PLACEHOLDER } from '../../../config';
import { getPeerTitle, isApiPeerUser } from '../../../global/helpers/peers';
import {
  selectChat, selectChatMessage, selectPeer, selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatInteger } from '../../../util/textFormat';
import renderText from '../../common/helpers/renderText';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Icon from '../../common/icons/Icon';
import PeerBadge from '../../common/PeerBadge';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import Modal from '../../ui/Modal';
import Separator from '../../ui/Separator';
import BalanceBlock from '../stars/BalanceBlock';
import StarSlider from './StarSlider';

import styles from './PaidReactionModal.module.scss';

export type OwnProps = {
  modal: TabState['paidReactionModal'];
};

type StateProps = {
  message?: ApiMessage;
  chat?: ApiChat;
  maxAmount: number;
  starBalance?: ApiStarsAmount;
  defaultPrivacy?: ApiPaidReactionPrivacyType;
  sendPaidReactionsAsPeerIds?: ApiSendAsPeerId[];
  currentUserId: string;
  currentUser: ApiUser;
};

type ReactorData = {
  amount: number;
  localAmount: number;
  isMy?: boolean;
  isAnonymous?: boolean;
  user?: ApiPeer;
};

const MAX_TOP_REACTORS = 3;
const DEFAULT_STARS_AMOUNT = 50;
const MAX_REACTION_AMOUNT = 2500;
const ANONYMOUS_PEER: CustomPeer = {
  avatarIcon: 'author-hidden',
  customPeerAvatarColor: '#9eaab5',
  isCustomPeer: true,
  titleKey: 'StarsReactionAnonymous',
};

const PaidReactionModal = ({
  modal,
  chat,
  message,
  maxAmount,
  starBalance,
  defaultPrivacy,
  sendPaidReactionsAsPeerIds,
  currentUserId,
  currentUser,
}: OwnProps & StateProps) => {
  const { closePaidReactionModal, addLocalPaidReaction, loadSendPaidReactionsAs } = getActions();

  const [starsAmount, setStarsAmount] = useState(DEFAULT_STARS_AMOUNT);
  const [isTouched, markTouched, unmarkTouched] = useFlag();
  const [shouldSendAsAnonymous, setShouldSendAsAnonymous] = useState(true);
  const [sendAsPeerId, setSendAsPeerId] = useState(currentUserId);

  const chatId = chat?.id;

  const senderPeer = sendAsPeerId ? (selectPeer(getGlobal(), sendAsPeerId)) : currentUser;

  const oldLang = useOldLang();
  const { isMobile } = useAppLayout();
  const lang = useLang();

  const handleShowInTopSendersChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setShouldSendAsAnonymous(!e.target.checked);
  });

  const handleAmountChange = useLastCallback((value: number) => {
    setStarsAmount(value);
    markTouched();
  });

  useEffect(() => {
    if (chatId && !sendPaidReactionsAsPeerIds) {
      loadSendPaidReactionsAs({ chatId });
    }
  }, [chatId, sendPaidReactionsAsPeerIds]);

  const filteredMyReactorIds = useMemo(() => {
    const result = sendPaidReactionsAsPeerIds?.map((peer) => peer.id)
      .filter((id) => id !== chatId);
    result?.unshift(currentUserId);
    return result;
  }, [sendPaidReactionsAsPeerIds, chatId, currentUserId]);

  const canChangeSendAsPeer = filteredMyReactorIds && filteredMyReactorIds.length > 1;

  useEffect(() => {
    if (!modal) {
      unmarkTouched();
    }
  }, [modal]);

  useEffect(() => {
    const currentReactor = message?.reactions?.topReactors?.find((reactor) => reactor.isMy);
    if (currentReactor) {
      setShouldSendAsAnonymous(Boolean(currentReactor.isAnonymous));
      if (currentReactor.peerId) {
        setSendAsPeerId(currentReactor.peerId);
      }
      return;
    }

    setShouldSendAsAnonymous(defaultPrivacy?.type === 'anonymous' || false);
    if (defaultPrivacy?.type === 'peer' && filteredMyReactorIds?.includes(defaultPrivacy.peerId)) {
      setSendAsPeerId(defaultPrivacy.peerId);
      return;
    }

    setSendAsPeerId(currentUserId);
  }, [defaultPrivacy, message?.reactions?.topReactors, filteredMyReactorIds, currentUserId]);

  const handleSend = useLastCallback(() => {
    if (!modal) return;

    addLocalPaidReaction({
      chatId: modal.chatId,
      messageId: modal.messageId,
      count: starsAmount,
      isPrivate: shouldSendAsAnonymous,
      peerId: shouldSendAsAnonymous || sendAsPeerId === currentUserId ? undefined : sendAsPeerId,
      shouldIgnoreDefaultPrivacy: true,
    });
    closePaidReactionModal();
  });

  const handleSendAsPeerChange = useLastCallback((peerId: string) => {
    setShouldSendAsAnonymous(false);
    setSendAsPeerId(peerId);
  });

  const renderMenuItem = useLastCallback((peerId: string) => {
    const peer = selectPeer(getGlobal(), peerId);
    const isSelected = sendAsPeerId === peerId && !shouldSendAsAnonymous;
    if (!peer) return undefined;

    return (
      <MenuItem

        onClick={() => handleSendAsPeerChange(peerId)}
      >
        <Avatar
          size="small"
          peer={peer}
        />
        <div className={buildClassName(styles.itemInfo)}>
          <FullNameTitle className={styles.itemTitle} peer={peer} noFake noVerified />
          <span className={styles.itemSubtitle}>
            {isApiPeerUser(peer) ? lang('PeerPersonalAccount') : lang('PeerChannel')}
          </span>
        </div>
        <Icon
          className={styles.itemIcon}
          name={isSelected ? 'check' : 'placeholder'}
        />
      </MenuItem>
    );
  });

  const SendAsPeerMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={buildClassName(styles.sendAsPeerMenuButton, isOpen ? 'active' : '')}
        onClick={onTrigger}
        ariaLabel={lang('AccDescrOpenMenu2')}
      >
        <Avatar
          className={styles.sendAsPeerButtonAvatar}
          size="mini"
          peer={shouldSendAsAnonymous ? ANONYMOUS_PEER : senderPeer}
        />
        <Icon
          name="down"
          className={styles.buttonDownIcon}
        />
      </Button>
    );
  }, [isMobile, lang, senderPeer, shouldSendAsAnonymous]);

  const sendAsPeersMenu = useMemo(() => {
    if (!canChangeSendAsPeer) return undefined;
    return (
      <DropdownMenu
        className={buildClassName(styles.sendAsPeerMenu, 'with-menu-transitions')}
        bubbleClassName={styles.sendAsPeerMenuBubble}
        trigger={SendAsPeerMenuButton}
        positionX="right"
        autoClose
      >
        {filteredMyReactorIds.map((id) => (
          renderMenuItem(id)
        ))}
      </DropdownMenu>
    );
  }, [SendAsPeerMenuButton, filteredMyReactorIds, canChangeSendAsPeer]);

  const topReactors = useMemo(() => {
    const global = getGlobal();
    const all = message?.reactions?.topReactors;
    if (!all) {
      return undefined;
    }

    const result: ReactorData[] = [];
    let hasCurrentSender = false;
    let myReactorAmount = 0;

    all.forEach((reactor) => {
      const peer = reactor.peerId ? selectPeer(global, reactor.peerId) : undefined;
      if (!peer && !reactor.isAnonymous && !reactor.isMy) return;
      if (reactor.isMy) {
        myReactorAmount = reactor.count;
      }

      if (reactor.isMy && (reactor.peerId !== sendAsPeerId || (reactor.isAnonymous && !shouldSendAsAnonymous))) return;

      const isCurrentReactor = sendAsPeerId === reactor.peerId || (shouldSendAsAnonymous && reactor.isAnonymous);

      if (isCurrentReactor) {
        hasCurrentSender = true;
      }

      result.push({
        amount: reactor.count,
        localAmount: isCurrentReactor && isTouched ? starsAmount : 0,
        isMy: reactor.isMy,
        isAnonymous: reactor.isAnonymous,
        user: peer,
      });
    });

    if (!hasCurrentSender) {
      const sender = selectPeer(global, sendAsPeerId);
      result.push({
        amount: myReactorAmount,
        localAmount: isTouched ? starsAmount : 0,
        isMy: true,
        user: sender,
      });
    }

    result.sort((a, b) => (b.amount + b.localAmount) - (a.amount + a.localAmount));

    return result.slice(0, MAX_TOP_REACTORS);
  }, [isTouched, message?.reactions?.topReactors, starsAmount, sendAsPeerId, shouldSendAsAnonymous]);

  const chatTitle = chat && getPeerTitle(oldLang, chat);

  return (
    <Modal
      isOpen={Boolean(modal)}
      onClose={closePaidReactionModal}
      isSlim
      hasAbsoluteCloseButton
      contentClassName={styles.content}
      isLowStackPriority
    >
      <div className={styles.sendAsPeersMenuContainer}>
        {sendAsPeersMenu}
      </div>
      <div className={styles.headerControlPanel}>
        <BalanceBlock balance={starBalance} className={styles.modalBalance} withAddButton />
      </div>

      <StarSlider
        className={styles.slider}
        defaultValue={DEFAULT_STARS_AMOUNT}
        maxValue={maxAmount}
        onChange={handleAmountChange}
      />
      <h3 className={styles.title}>{oldLang('StarsReactionTitle')}</h3>
      <div className={styles.description}>
        {renderText(oldLang('StarsReactionText', chatTitle), ['simple_markdown', 'emoji'])}
      </div>
      <Separator>
        {topReactors && <div className={styles.topLabel}>{oldLang('StarsReactionTopSenders')}</div>}
      </Separator>
      {topReactors && (
        <div className={styles.top}>
          {topReactors.map((reactor) => {
            const countText = formatInteger(reactor.amount + reactor.localAmount);
            const peer = (reactor.isAnonymous || !reactor.user || (reactor.isMy && shouldSendAsAnonymous))
              ? ANONYMOUS_PEER : reactor.user;
            const text = 'isCustomPeer' in peer ? oldLang(peer.titleKey)
              : peer && getPeerTitle(oldLang, peer);
            return (
              <PeerBadge
                className={styles.topPeer}
                key={`${reactor.user?.id || 'anonymous'}-${countText}`}
                peer={peer}
                badgeText={countText}
                badgeIcon="star"
                badgeClassName={styles.topBadge}
                text={text}
              />
            );
          })}
        </div>
      )}
      {topReactors && (<Separator className={styles.separator} />)}
      <Checkbox
        className={buildClassName(styles.checkBox, 'dialog-checkbox')}
        checked={!shouldSendAsAnonymous}
        onChange={handleShowInTopSendersChange}
        label={oldLang('StarsReactionShowMeInTopSenders')}
      />
      <Button
        onClick={handleSend}
      >
        {lang('SendPaidReaction', { amount: starsAmount }, {
          withNodes: true,
          specialReplacement: {
            [STARS_ICON_PLACEHOLDER]: <Icon className={styles.buttonStar} name="star" />,
          },
        })}
      </Button>
      <p className={styles.disclaimer}>
        {lang('StarsReactionTerms', {
          link: <SafeLink text={lang('StarsReactionLinkText')} url={lang('StarsReactionLink')} />,
        }, {
          withNodes: true,
        })}
      </p>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const chat = modal && selectChat(global, modal.chatId);
    const message = modal && selectChatMessage(global, modal.chatId, modal.messageId);
    const starBalance = global.stars?.balance;
    const maxAmount = global.appConfig.paidReactionMaxAmount || MAX_REACTION_AMOUNT;
    const defaultPrivacy = global.settings.paidReactionPrivacy;
    const sendPaidReactionsAsPeerIds = chat?.sendPaidReactionsAsPeerIds;
    const currentUserId = global.currentUserId!;
    const currentUser = selectUser(global, currentUserId)!;

    return {
      chat,
      message,
      starBalance,
      maxAmount,
      defaultPrivacy,
      sendPaidReactionsAsPeerIds,
      currentUserId,
      currentUser,
    };
  },
)(PaidReactionModal));
