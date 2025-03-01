import type { ChangeEvent } from 'react';
import React, {
  memo, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ThemeKey } from '../../../types';
import type { GiftOption } from './GiftModal';
import { type ApiMessage, type ApiPeer, MAIN_THREAD_ID } from '../../../api/types';

import { getPeerTitle } from '../../../global/helpers';
import { isApiPeerUser } from '../../../global/helpers/peers';
import { selectPeer, selectTabState, selectTheme } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatStarsAsIcon } from '../../../util/localization/format';

import useCustomBackground from '../../../hooks/useCustomBackground';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PremiumProgress from '../../common/PremiumProgress';
import ActionMessage from '../../middle/message/ActionMessage';
import Button from '../../ui/Button';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';
import Switcher from '../../ui/Switcher';
import TextArea from '../../ui/TextArea';

import styles from './GiftComposer.module.scss';

export type OwnProps = {
  gift: GiftOption;
  peerId: string;
};

export type StateProps = {
  captionLimit?: number;
  theme: ThemeKey;
  isBackgroundBlurred?: boolean;
  patternColor?: string;
  customBackground?: string;
  backgroundColor?: string;
  peer?: ApiPeer;
  currentUserId?: string;
  isPaymentFormLoading?: boolean;
};

const LIMIT_DISPLAY_THRESHOLD = 50;

function GiftComposer({
  gift,
  peerId,
  peer,
  captionLimit,
  theme,
  isBackgroundBlurred,
  patternColor,
  backgroundColor,
  customBackground,
  currentUserId,
  isPaymentFormLoading,
}: OwnProps & StateProps) {
  const { sendStarGift, openInvoice, openGiftUpgradeModal } = getActions();

  const lang = useLang();

  const [giftMessage, setGiftMessage] = useState<string>('');
  const [shouldHideName, setShouldHideName] = useState<boolean>(false);
  const [shouldPayForUpgrade, setShouldPayForUpgrade] = useState<boolean>(false);

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const isStarGift = 'id' in gift;
  const isPeerUser = peer && isApiPeerUser(peer);
  const isSelf = peerId === currentUserId;

  const localMessage = useMemo(() => {
    if (!isStarGift) {
      return {
        id: -1,
        chatId: '0',
        isOutgoing: false,
        senderId: currentUserId,
        date: Math.floor(Date.now() / 1000),
        content: {
          action: {
            mediaType: 'action',
            type: 'giftPremium',
            currency: gift.currency,
            amount: gift.amount,
            months: gift.months,
            message: giftMessage ? { text: giftMessage } : undefined,
          },
        },
      } satisfies ApiMessage;
    }

    return {
      id: -1,
      chatId: '0',
      isOutgoing: false,
      senderId: currentUserId,
      date: Math.floor(Date.now() / 1000),
      content: {
        action: {
          mediaType: 'action',
          type: 'starGift',
          message: giftMessage?.length ? {
            text: giftMessage,
          } : undefined,
          isNameHidden: shouldHideName || undefined,
          starsToConvert: gift.starsToConvert,
          canUpgrade: shouldPayForUpgrade || undefined,
          alreadyPaidUpgradeStars: shouldPayForUpgrade ? gift.upgradeStars : undefined,
          gift,
          peerId,
          fromId: currentUserId,
        },
      },
    } satisfies ApiMessage;
  }, [currentUserId, gift, giftMessage, isStarGift, shouldHideName, shouldPayForUpgrade, peerId]);

  const handleGiftMessageChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setGiftMessage(e.target.value);
  });

  const handleShouldHideNameChange = useLastCallback(() => {
    setShouldHideName(!shouldHideName);
  });

  const handleShouldPayForUpgradeChange = useLastCallback(() => {
    setShouldPayForUpgrade(!shouldPayForUpgrade);
  });

  const handleOpenUpgradePreview = useLastCallback(() => {
    if (!isStarGift) return;
    openGiftUpgradeModal({
      giftId: gift.id,
      peerId,
    });
  });

  const handleMainButtonClick = useLastCallback(() => {
    if (isStarGift) {
      sendStarGift({
        peerId,
        shouldHideName,
        gift,
        message: giftMessage ? { text: giftMessage } : undefined,
        shouldUpgrade: shouldPayForUpgrade,
      });
      return;
    }

    openInvoice({
      type: 'giftcode',
      userIds: [peerId],
      currency: gift.currency,
      amount: gift.amount,
      option: gift,
      message: giftMessage ? { text: giftMessage } : undefined,
    });
  });

  function renderOptionsSection() {
    const symbolsLeft = captionLimit ? captionLimit - giftMessage.length : undefined;

    const title = getPeerTitle(lang, peer!)!;
    return (
      <div className={styles.optionsSection}>
        <TextArea
          className={styles.messageInput}
          onChange={handleGiftMessageChange}
          value={giftMessage}
          label={lang('GiftMessagePlaceholder')}
          maxLength={captionLimit}
          maxLengthIndicator={symbolsLeft && symbolsLeft < LIMIT_DISPLAY_THRESHOLD ? symbolsLeft.toString() : undefined}
        />

        {isStarGift && gift.upgradeStars && (
          <ListItem className={styles.switcher} narrow ripple onClick={handleShouldPayForUpgradeChange}>
            <span>
              {lang('GiftMakeUnique', {
                stars: formatStarsAsIcon(lang, gift.upgradeStars, { className: styles.switcherStarIcon }),
              }, { withNodes: true })}
            </span>
            <Switcher
              checked={shouldPayForUpgrade}
              onChange={handleShouldPayForUpgradeChange}
              label={lang('GiftMakeUniqueAcc')}
            />
          </ListItem>
        )}
        {isStarGift && gift.upgradeStars && (
          <div className={styles.description}>
            {isPeerUser
              ? lang('GiftMakeUniqueDescription', {
                user: title,
                link: <Link isPrimary onClick={handleOpenUpgradePreview}>{lang('GiftMakeUniqueLink')}</Link>,
              }, {
                withNodes: true,
              })
              : lang('GiftMakeUniqueDescriptionChannel', {
                peer: title,
                link: <Link isPrimary onClick={handleOpenUpgradePreview}>{lang('GiftMakeUniqueLink')}</Link>,
              }, {
                withNodes: true,
              })}
          </div>
        )}

        {isStarGift && (
          <ListItem className={styles.switcher} narrow ripple onClick={handleShouldHideNameChange}>
            <span>{lang('GiftHideMyName')}</span>
            <Switcher
              checked={shouldHideName}
              onChange={handleShouldHideNameChange}
              label={lang('GiftHideMyName')}
            />
          </ListItem>
        )}
        {isStarGift && (
          <div className={styles.description}>
            {isSelf ? lang('GiftHideNameDescriptionSelf')
              : isPeerUser ? lang('GiftHideNameDescription', { receiver: title })
                : lang('GiftHideNameDescriptionChannel')}
          </div>
        )}
      </div>
    );
  }

  function renderFooter() {
    const amount = isStarGift
      ? formatStarsAsIcon(lang, gift.stars + (shouldPayForUpgrade ? gift.upgradeStars! : 0), { asFont: true })
      : formatCurrency(lang, gift.amount, gift.currency);

    return (
      <div className={styles.footer}>
        {isStarGift && gift.availabilityRemains && (
          <PremiumProgress
            isPrimary
            progress={gift.availabilityRemains / gift.availabilityTotal!}
            rightText={lang('GiftSoldCount', {
              count: gift.availabilityTotal! - gift.availabilityRemains,
            })}
            leftText={lang('GiftLeftCount', { count: gift.availabilityRemains })}
            className={styles.limited}
          />
        )}
        <Button
          className={styles.mainButton}
          size="smaller"
          onClick={handleMainButtonClick}
          isLoading={isPaymentFormLoading}
        >
          {lang('GiftSend', {
            amount,
          }, {
            withNodes: true,
          })}
        </Button>
      </div>
    );
  }

  const bgClassName = buildClassName(
    styles.background,
    styles.withTransition,
    customBackground && styles.customBgImage,
    backgroundColor && styles.customBgColor,
    customBackground && isBackgroundBlurred && styles.blurred,
  );

  return (
    <div className={buildClassName(styles.root, 'custom-scroll')}>
      <div
        className={buildClassName(styles.actionMessageView, 'MessageList')}
        // @ts-ignore -- FIXME: Find a way to disable interactions but keep a11y
        inert
        style={buildStyle(
          `--pattern-color: ${patternColor}`,
          backgroundColor && `--theme-background-color: ${backgroundColor}`,
        )}
      >
        <div
          className={bgClassName}
          style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
        />
        <ActionMessage
          key={isStarGift ? gift.id : gift.months}
          message={localMessage}
          threadId={MAIN_THREAD_ID}
          appearanceOrder={0}
        />
      </div>
      {renderOptionsSection()}
      <div className={styles.spacer} />
      {renderFooter()}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { peerId }): StateProps => {
    const theme = selectTheme(global);
    const {
      isBlurred: isBackgroundBlurred,
      patternColor,
      background: customBackground,
      backgroundColor,
    } = global.settings.themes[theme] || {};
    const peer = selectPeer(global, peerId);

    const tabState = selectTabState(global);

    return {
      peer,
      theme,
      isBackgroundBlurred,
      patternColor,
      customBackground,
      backgroundColor,
      captionLimit: global.appConfig?.starGiftMaxMessageLength,
      currentUserId: global.currentUserId,
      isPaymentFormLoading: tabState.isPaymentFormLoading,
    };
  },
)(GiftComposer));
