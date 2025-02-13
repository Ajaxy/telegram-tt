import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiMessage, ApiStarsAmount, ApiUser,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { CustomPeer } from '../../../types';

import { STARS_ICON_PLACEHOLDER } from '../../../config';
import { getChatTitle, getUserFullName } from '../../../global/helpers';
import { selectChat, selectChatMessage, selectUser } from '../../../global/selectors';
import { formatInteger } from '../../../util/textFormat';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import PeerBadge from '../../common/PeerBadge';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
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
  defaultPrivacy?: boolean;
};

type ReactorData = {
  amount: number;
  localAmount: number;
  isMe?: boolean;
  isAnonymous?: boolean;
  user?: ApiUser;
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
}: OwnProps & StateProps) => {
  const { closePaidReactionModal, addLocalPaidReaction } = getActions();

  const [starsAmount, setStarsAmount] = useState(DEFAULT_STARS_AMOUNT);
  const [isTouched, markTouched, unmarkTouched] = useFlag();
  const [shouldShowUp, setShouldShowUp] = useState(true);

  const oldLang = useOldLang();
  const lang = useLang();

  const handleAnonimityChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setShouldShowUp(e.target.checked);
  });

  const handleAmountChange = useLastCallback((value: number) => {
    setStarsAmount(value);
    markTouched();
  });

  useEffect(() => {
    if (!modal) {
      unmarkTouched();
    }
  }, [modal]);

  useEffect(() => {
    const currentReactor = message?.reactions?.topReactors?.find((reactor) => reactor.isMe);
    if (currentReactor) {
      setShouldShowUp(!currentReactor.isAnonymous);
      return;
    }

    setShouldShowUp(defaultPrivacy || true);
  }, [defaultPrivacy, message?.reactions?.topReactors]);

  const handleSend = useLastCallback(() => {
    if (!modal) return;

    addLocalPaidReaction({
      chatId: modal.chatId,
      messageId: modal.messageId,
      count: starsAmount,
      isPrivate: !shouldShowUp,
    });
    closePaidReactionModal();
  });

  const topReactors = useMemo(() => {
    const global = getGlobal();
    const all = message?.reactions?.topReactors;
    if (!all) {
      return undefined;
    }

    const result: ReactorData[] = [];
    let hasMe = false;

    all.forEach((reactor) => {
      const user = reactor.peerId ? selectUser(global, reactor.peerId) : undefined;
      if (!user && !reactor.isAnonymous && !reactor.isMe) return;

      if (reactor.isMe) {
        hasMe = true;
      }

      result.push({
        amount: reactor.count,
        localAmount: reactor.isMe && isTouched ? starsAmount : 0,
        isMe: reactor.isMe,
        isAnonymous: reactor.isAnonymous,
        user,
      });
    });

    if (!hasMe && isTouched) {
      const me = selectUser(global, global.currentUserId!);
      result.push({
        amount: 0,
        localAmount: starsAmount,
        isMe: true,
        user: me,
      });
    }

    result.sort((a, b) => (b.amount + b.localAmount) - (a.amount + a.localAmount));

    return result.slice(0, MAX_TOP_REACTORS);
  }, [isTouched, message?.reactions?.topReactors, starsAmount]);

  const chatTitle = chat && getChatTitle(oldLang, chat);

  return (
    <Modal
      isOpen={Boolean(modal)}
      onClose={closePaidReactionModal}
      isSlim
      hasAbsoluteCloseButton
      contentClassName={styles.content}
    >
      <BalanceBlock balance={starBalance} className={styles.modalBalance} />
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
            const peer = (reactor.isAnonymous || !reactor.user || (reactor.isMe && !shouldShowUp))
              ? ANONYMOUS_PEER : reactor.user;
            const text = 'isCustomPeer' in peer ? oldLang(peer.titleKey) : getUserFullName(peer);
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
      <Checkbox
        className="dialog-checkbox"
        checked={shouldShowUp}
        onChange={handleAnonimityChange}
        label={oldLang('StarsReactionShowMeInTopSenders')}
      />
      <Button
        size="smaller"
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
  (global, { modal }): StateProps => {
    const chat = modal && selectChat(global, modal.chatId);
    const message = modal && selectChatMessage(global, modal.chatId, modal.messageId);
    const starBalance = global.stars?.balance;
    const maxAmount = global.appConfig?.paidReactionMaxAmount || MAX_REACTION_AMOUNT;
    const defaultPrivacy = global.settings.paidReactionPrivacy;

    return {
      chat,
      message,
      starBalance,
      maxAmount,
      defaultPrivacy,
    };
  },
)(PaidReactionModal));
