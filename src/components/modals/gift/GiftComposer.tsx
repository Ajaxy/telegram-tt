import type { ChangeEvent } from 'react';
import React, {
  memo, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage, ApiUser } from '../../../api/types';
import type { ThemeKey } from '../../../types';
import type { GiftOption } from './GiftModal';

import { STARS_CURRENCY_CODE } from '../../../config';
import { getUserFullName } from '../../../global/helpers';
import { selectTabState, selectTheme, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatStarsAsIcon } from '../../../util/localization/format';

import useCustomBackground from '../../../hooks/useCustomBackground';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PremiumProgress from '../../common/PremiumProgress';
import ActionMessage from '../../middle/ActionMessage';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Switcher from '../../ui/Switcher';
import TextArea from '../../ui/TextArea';

import styles from './GiftComposer.module.scss';

export type OwnProps = {
  gift: GiftOption;
  userId: string;
};

export type StateProps = {
  captionLimit?: number;
  theme: ThemeKey;
  isBackgroundBlurred?: boolean;
  patternColor?: string;
  customBackground?: string;
  backgroundColor?: string;
  user?: ApiUser;
  currentUserId?: string;
  isPaymentFormLoading?: boolean;
};

const LIMIT_DISPLAY_THRESHOLD = 50;

function GiftComposer({
  gift,
  userId,
  user,
  captionLimit,
  theme,
  isBackgroundBlurred,
  patternColor,
  backgroundColor,
  customBackground,
  currentUserId,
  isPaymentFormLoading,
}: OwnProps & StateProps) {
  const { sendStarGift, openInvoice } = getActions();

  const lang = useLang();

  const [giftMessage, setGiftMessage] = useState<string>('');
  const [shouldHideName, setShouldHideName] = useState<boolean>(false);

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const isStarGift = 'id' in gift;

  const localMessage = useMemo(() => {
    if (!isStarGift) {
      return {
        id: -1,
        chatId: '0',
        isOutgoing: true,
        senderId: currentUserId,
        date: Math.floor(Date.now() / 1000),
        content: {
          action: {
            targetUserIds: [userId],
            mediaType: 'action',
            text: 'ActionGiftInbound',
            type: 'giftPremium',
            amount: gift.amount,
            currency: gift.currency,
            months: gift.months,
            message: {
              text: giftMessage,
            },
            translationValues: ['%action_origin%', '%gift_payment_amount%'],
          },
        },
      } satisfies ApiMessage;
    }

    return {
      id: -1,
      chatId: currentUserId!,
      isOutgoing: false,
      senderId: currentUserId,
      date: Math.floor(Date.now() / 1000),
      content: {
        action: {
          targetUserIds: [userId],
          mediaType: 'action',
          text: 'ActionGiftInbound',
          type: 'starGift',
          currency: STARS_CURRENCY_CODE,
          amount: gift.stars,
          starGift: {
            type: 'starGift',
            message: giftMessage?.length ? {
              text: giftMessage,
            } : undefined,
            isNameHidden: shouldHideName,
            starsToConvert: gift.starsToConvert,
            isSaved: false,
            gift,
          },
          translationValues: ['%action_origin%', '%gift_payment_amount%'],
        },
      },
    } satisfies ApiMessage;
  }, [currentUserId, gift, giftMessage, isStarGift, shouldHideName, userId]);

  const handleGiftMessageChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setGiftMessage(e.target.value);
  });

  const handleShouldHideNameChange = useLastCallback(() => {
    setShouldHideName(!shouldHideName);
  });

  const handleMainButtonClick = useLastCallback(() => {
    if (isStarGift) {
      sendStarGift({
        userId,
        shouldHideName,
        gift,
        message: giftMessage ? { text: giftMessage } : undefined,
      });
      return;
    }

    openInvoice({
      type: 'giftcode',
      userIds: [userId],
      currency: gift.currency,
      amount: gift.amount,
      option: gift,
      message: giftMessage ? { text: giftMessage } : undefined,
    });
  });

  function renderOptionsSection() {
    const symbolsLeft = captionLimit ? captionLimit - giftMessage.length : undefined;
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
      </div>
    );
  }

  function renderFooter() {
    const userFullName = getUserFullName(user)!;

    const amount = isStarGift
      ? formatStarsAsIcon(lang, gift.stars, true)
      : formatCurrency(gift.amount, gift.currency);

    return (
      <div className={styles.footer}>
        {isStarGift && (
          <div className={styles.description}>
            {lang('GiftHideNameDescription', { profile: userFullName, receiver: userFullName })}
          </div>
        )}

        <div className={styles.spacer} />

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
    <div className={buildClassName(styles.root, 'no-scroll')}>
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
        <ActionMessage key={isStarGift ? gift.id : gift.months} message={localMessage} />
      </div>
      {renderOptionsSection()}
      {renderFooter()}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const theme = selectTheme(global);
    const {
      isBlurred: isBackgroundBlurred,
      patternColor,
      background: customBackground,
      backgroundColor,
    } = global.settings.themes[theme] || {};
    const user = selectUser(global, userId);

    const tabState = selectTabState(global);

    return {
      user,
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
