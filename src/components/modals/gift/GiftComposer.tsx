import type { ChangeEvent } from 'react';
import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ThemeKey } from '../../../types';
import type { GiftOption } from './GiftModal';
import {
  type ApiMessage, type ApiPeer, type ApiStarGiftAuctionState, type ApiStarsAmount, MAIN_THREAD_ID,
} from '../../../api/types';

import { getPeerTitle, isApiPeerUser } from '../../../global/helpers/peers';
import {
  selectPeer, selectPeerPaidMessagesStars, selectTabState, selectTheme, selectThemeValues, selectUserFullInfo,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { formatCountdown } from '../../../util/dates/dateFormat';
import { HOUR } from '../../../util/dates/units';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatStarsAsIcon } from '../../../util/localization/format';
import { getServerTime } from '../../../util/serverTime';

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
import TextTimer from '../../ui/TextTimer';

import styles from './GiftComposer.module.scss';

export type OwnProps = {
  gift: GiftOption;
  giftByStars?: GiftOption;
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
  starBalance?: ApiStarsAmount;
  paidMessagesStars?: number;
  areUniqueStarGiftsDisallowed?: boolean;
  shouldDisallowLimitedStarGifts?: boolean;
  giftAuction?: ApiStarGiftAuctionState;
};

const LIMIT_DISPLAY_THRESHOLD = 50;
const TEXT_TIMER_THRESHOLD = 48 * HOUR;

function GiftComposer({
  gift,
  giftByStars,
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
  starBalance,
  paidMessagesStars,
  areUniqueStarGiftsDisallowed,
  shouldDisallowLimitedStarGifts,
  giftAuction,
}: OwnProps & StateProps) {
  const {
    sendStarGift, sendPremiumGiftByStars, openInvoice, openGiftUpgradeModal, openStarsBalanceModal,
    openGiftAuctionBidModal, openGiftAuctionInfoModal, openGiftAuctionChangeRecipientModal,
  } = getActions();

  const lang = useLang();

  const [giftMessage, setGiftMessage] = useState<string>('');
  const [shouldHideName, setShouldHideName] = useState<boolean>(false);
  const [shouldPayForUpgrade, setShouldPayForUpgrade] = useState<boolean>(false);
  const [shouldPayByStars, setShouldPayByStars] = useState<boolean>(false);

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  useEffect(() => {
    if (shouldDisallowLimitedStarGifts) {
      setShouldPayForUpgrade(true);
    }
  }, [shouldDisallowLimitedStarGifts, shouldPayForUpgrade]);

  const isStarGift = 'id' in gift && gift.type === 'starGift';
  const isPremiumGift = 'months' in gift;
  const hasPremiumByStars = giftByStars && 'amount' in giftByStars;
  const isPeerUser = peer && isApiPeerUser(peer);
  const isSelf = peerId === currentUserId;

  const localMessage = useMemo(() => {
    if (isPremiumGift) {
      const currentGift = shouldPayByStars && hasPremiumByStars ? giftByStars : gift;
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
            amount: currentGift.amount,
            currency: currentGift.currency,
            days: gift.months * 30,
            message: giftMessage ? { text: giftMessage } : undefined,
          },
        },
      } satisfies ApiMessage;
    }

    if (isStarGift) {
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
    }
    return undefined;
  }, [currentUserId, gift, giftMessage, isStarGift,
    shouldHideName, shouldPayForUpgrade, peerId,
    shouldPayByStars, hasPremiumByStars, giftByStars, isPremiumGift]);

  const handleGiftMessageChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setGiftMessage(e.target.value);
  });

  const handleShouldHideNameChange = useLastCallback(() => {
    setShouldHideName(!shouldHideName);
  });

  const handleShouldPayForUpgradeChange = useLastCallback(() => {
    setShouldPayForUpgrade(!shouldPayForUpgrade);
  });

  const toggleShouldPayByStars = useLastCallback(() => {
    if (hasPremiumByStars) setShouldPayByStars(!shouldPayByStars);
  });

  const handleOpenUpgradePreview = useLastCallback(() => {
    if (!isStarGift) return;
    openGiftUpgradeModal({
      giftId: gift.id,
      peerId,
    });
  });

  const handleGetMoreStars = useLastCallback(() => {
    openStarsBalanceModal({});
  });

  const handleLearnMoreClick = useLastCallback(() => {
    if (!giftAuction) return;
    openGiftAuctionInfoModal({ auctionGiftId: giftAuction.gift.id });
  });

  const handleMainButtonClick = useLastCallback(() => {
    if (giftAuction) {
      const existingBidPeerId = giftAuction.userState.bidPeerId;
      if (existingBidPeerId && existingBidPeerId !== peerId) {
        openGiftAuctionChangeRecipientModal({
          auctionGiftId: giftAuction.gift.id,
          oldPeerId: existingBidPeerId,
          newPeerId: peerId,
          message: giftMessage || undefined,
          shouldHideName: shouldHideName || undefined,
        });
        return;
      }

      openGiftAuctionBidModal({
        auctionGiftId: giftAuction.gift.id,
        peerId,
        message: giftMessage || undefined,
        shouldHideName: shouldHideName || undefined,
      });
      return;
    }

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

    if (shouldPayByStars && hasPremiumByStars) {
      sendPremiumGiftByStars({
        userId: peerId,
        months: giftByStars.months,
        amount: giftByStars.amount,
        message: giftMessage ? { text: giftMessage } : undefined,
      });
      return;
    }

    if (isPremiumGift) {
      openInvoice({
        type: 'giftcode',
        userIds: [peerId],
        currency: gift.currency,
        amount: gift.amount,
        option: gift,
        message: giftMessage ? { text: giftMessage } : undefined,
      });
    }
  });

  const canUseStarsPayment = hasPremiumByStars && starBalance && (starBalance.amount > giftByStars.amount);
  function renderOptionsSection() {
    const symbolsLeft = captionLimit ? captionLimit - giftMessage.length : undefined;

    const title = getPeerTitle(lang, peer!)!;
    return (
      <div className={styles.optionsSection}>

        {!paidMessagesStars && (
          <TextArea
            className={styles.messageInput}
            onChange={handleGiftMessageChange}
            value={giftMessage}
            label={lang('GiftMessagePlaceholder')}
            maxLength={captionLimit}
            maxLengthIndicator={
              symbolsLeft && symbolsLeft < LIMIT_DISPLAY_THRESHOLD ? symbolsLeft.toString() : undefined
            }
          />
        )}

        {canUseStarsPayment && (
          <ListItem className={styles.switcher} narrow ripple onClick={toggleShouldPayByStars}>
            <span>
              {lang('GiftPremiumPayWithStars', {
                stars: formatStarsAsIcon(lang, giftByStars.amount, { className: styles.switcherStarIcon }),
              }, { withNodes: true })}
            </span>
            <Switcher
              checked={shouldPayByStars}
              onChange={toggleShouldPayByStars}
              label={lang('GiftPremiumPayWithStarsAcc')}
            />
          </ListItem>
        )}

        {hasPremiumByStars && starBalance && (
          <div className={styles.description}>
            {lang('GiftPremiumDescriptionYourBalance', {
              stars: formatStarsAsIcon(lang, starBalance.amount, { className: styles.switcherStarIcon }),
              link: <Link isPrimary onClick={handleGetMoreStars}>{lang('GetMoreStarsLinkText')}</Link>,
            }, {
              withNodes: true,
              withMarkdown: true,
            })}
          </div>
        )}

        {isStarGift && Boolean(gift.upgradeStars) && !areUniqueStarGiftsDisallowed && (
          <ListItem
            className={styles.switcher}
            narrow
            ripple
            onClick={handleShouldPayForUpgradeChange}
            disabled={shouldDisallowLimitedStarGifts}
          >
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
        {isStarGift && Boolean(gift.upgradeStars) && !areUniqueStarGiftsDisallowed && (
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
    const amount = shouldPayByStars && hasPremiumByStars
      ? formatStarsAsIcon(lang, giftByStars.amount, { asFont: true })
      : isStarGift
        ? formatStarsAsIcon(lang, gift.stars + (shouldPayForUpgrade ? gift.upgradeStars! : 0), { asFont: true })
        : isPremiumGift ? formatCurrency(lang, gift.amount, gift.currency) : undefined;

    const giftsPerRound = giftAuction?.gift.giftsPerRound;
    const auctionEndDate = giftAuction?.state.endDate;
    const auctionTimeLeft = auctionEndDate ? auctionEndDate - getServerTime() : undefined;
    const shouldUseTextTimer = auctionTimeLeft !== undefined && auctionTimeLeft > 0
      && auctionTimeLeft < TEXT_TIMER_THRESHOLD;

    return (
      <div className={styles.footer}>
        {isStarGift && Boolean(gift.availabilityRemains) && (
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
        {giftAuction && Boolean(giftsPerRound) && (
          <div className={styles.bottomDescription}>
            {lang('GiftAuctionDescription', {
              count: giftsPerRound,
              link: <Link isPrimary onClick={handleLearnMoreClick}>{lang('GiftAuctionLearnMore')}</Link>,
            }, { pluralValue: giftsPerRound, withNodes: true })}
          </div>
        )}
        <Button
          className={styles.mainButton}
          size={auctionTimeLeft ? undefined : 'smaller'}
          onClick={handleMainButtonClick}
          isLoading={isPaymentFormLoading}
          noForcedUpperCase
        >
          {giftAuction ? (
            <div>
              <div>
                {lang('GiftAuctionPlaceBid')}
              </div>
              {auctionTimeLeft !== undefined && auctionTimeLeft > 0 && (
                <div className={styles.buttonSubtitle}>
                  {lang('GiftAuctionTimeLeft', {
                    time: shouldUseTextTimer
                      ? <TextTimer endsAt={auctionEndDate!} />
                      : formatCountdown(lang, auctionTimeLeft),
                  }, { withNodes: true })}
                </div>
              )}
            </div>
          ) : lang('GiftSend', {
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

  if ((!isStarGift && !isPremiumGift) || !localMessage) return;

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
          key={isStarGift ? gift.id : isPremiumGift ? gift.months : undefined}
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
  (global, { peerId, gift }): Complete<StateProps> => {
    const theme = selectTheme(global);
    const {
      stars,
    } = global;
    const {
      isBlurred: isBackgroundBlurred,
      patternColor,
      background: customBackground,
      backgroundColor,
    } = selectThemeValues(global, theme) || {};
    const peer = selectPeer(global, peerId);
    const paidMessagesStars = selectPeerPaidMessagesStars(global, peerId);
    const userFullInfo = selectUserFullInfo(global, peerId);
    const currentUserId = global.currentUserId;
    const isGiftForSelf = currentUserId === peerId;
    const areUniqueStarGiftsDisallowed = !isGiftForSelf
      && userFullInfo?.disallowedGifts?.shouldDisallowUniqueStarGifts;
    const shouldDisallowLimitedStarGifts = !isGiftForSelf
      && userFullInfo?.disallowedGifts?.shouldDisallowLimitedStarGifts;

    const tabState = selectTabState(global);
    const auctionGiftId = 'id' in gift && gift.type === 'starGift' && gift.isAuction ? gift.id : undefined;
    const giftAuction = auctionGiftId
      ? global.giftAuctionByGiftId?.[auctionGiftId] : undefined;

    return {
      starBalance: stars?.balance,
      peer,
      theme,
      isBackgroundBlurred,
      patternColor,
      customBackground,
      backgroundColor,
      captionLimit: global.appConfig.starGiftMaxMessageLength,
      currentUserId: global.currentUserId,
      isPaymentFormLoading: tabState.isPaymentFormLoading,
      paidMessagesStars,
      areUniqueStarGiftsDisallowed,
      shouldDisallowLimitedStarGifts,
      giftAuction,
    };
  },
)(GiftComposer));
