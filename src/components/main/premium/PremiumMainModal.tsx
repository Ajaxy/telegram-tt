import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiPremiumPromo, ApiPremiumSubscriptionOption, ApiSticker, ApiStickerSet, ApiUser,
} from '../../../api/types';
import type { ApiPremiumSection, GlobalState } from '../../../global/types';

import { PREMIUM_FEATURE_SECTIONS, TME_LINK_PREFIX } from '../../../config';
import { getUserFullName } from '../../../global/helpers';
import {
  selectIsCurrentUserPremium, selectStickerSet,
  selectTabState, selectUser,
} from '../../../global/selectors';
import { selectPremiumLimit } from '../../../global/selectors/limits';
import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';

import CustomEmoji from '../../common/CustomEmoji';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import Transition from '../../ui/Transition';
import PremiumFeatureItem from './PremiumFeatureItem';
import PremiumFeatureModal, {
  PREMIUM_FEATURE_DESCRIPTIONS,
  PREMIUM_FEATURE_TITLES,
} from './PremiumFeatureModal';
import PremiumSubscriptionOption from './PremiumSubscriptionOption';

import styles from './PremiumMainModal.module.scss';

import PremiumAds from '../../../assets/premium/PremiumAds.svg';
import PremiumBadge from '../../../assets/premium/PremiumBadge.svg';
import PremiumChats from '../../../assets/premium/PremiumChats.svg';
import PremiumEmoji from '../../../assets/premium/PremiumEmoji.svg';
import PremiumFile from '../../../assets/premium/PremiumFile.svg';
import PremiumLastSeen from '../../../assets/premium/PremiumLastSeen.svg';
import PremiumLimits from '../../../assets/premium/PremiumLimits.svg';
import PremiumLogo from '../../../assets/premium/PremiumLogo.svg';
import PremiumMessagePrivacy from '../../../assets/premium/PremiumMessagePrivacy.svg';
import PremiumReactions from '../../../assets/premium/PremiumReactions.svg';
import PremiumSpeed from '../../../assets/premium/PremiumSpeed.svg';
import PremiumStatus from '../../../assets/premium/PremiumStatus.svg';
import PremiumStickers from '../../../assets/premium/PremiumStickers.svg';
import PremiumTags from '../../../assets/premium/PremiumTags.svg';
import PremiumTranslate from '../../../assets/premium/PremiumTranslate.svg';
import PremiumVideo from '../../../assets/premium/PremiumVideo.svg';
import PremiumVoice from '../../../assets/premium/PremiumVoice.svg';

const LIMIT_ACCOUNTS = 4;
const STATUS_EMOJI_SIZE = 8 * REM;

const PREMIUM_FEATURE_COLOR_ICONS: Record<ApiPremiumSection, string> = {
  stories: PremiumStatus,
  double_limits: PremiumLimits,
  infinite_reactions: PremiumReactions,
  premium_stickers: PremiumStickers,
  animated_emoji: PremiumEmoji,
  no_ads: PremiumAds,
  voice_to_text: PremiumVoice,
  profile_badge: PremiumBadge,
  faster_download: PremiumSpeed,
  more_upload: PremiumFile,
  advanced_chat_management: PremiumChats,
  animated_userpics: PremiumVideo,
  emoji_status: PremiumStatus,
  translations: PremiumTranslate,
  saved_tags: PremiumTags,
  last_seen: PremiumLastSeen,
  message_privacy: PremiumMessagePrivacy,
};

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  currentUserId?: string;
  promo?: ApiPremiumPromo;
  fromUser?: ApiUser;
  fromUserStatusEmoji?: ApiSticker;
  fromUserStatusSet?: ApiStickerSet;
  toUser?: ApiUser;
  initialSection?: ApiPremiumSection;
  isPremium?: boolean;
  isSuccess?: boolean;
  isGift?: boolean;
  monthsAmount?: number;
  limitChannels: number;
  limitPins: number;
  limitLinks: number;
  limitFolders: number;
  limits?: NonNullable<GlobalState['appConfig']>['limits'];
  premiumSlug?: string;
  premiumBotUsername?: string;
  premiumPromoOrder?: ApiPremiumSection[];
};

const PremiumMainModal: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  fromUser,
  fromUserStatusEmoji,
  fromUserStatusSet,
  promo,
  initialSection,
  isPremium,
  limitChannels,
  limitLinks,
  limitFolders,
  limitPins,
  limits,
  premiumSlug,
  premiumBotUsername,
  isSuccess,
  isGift,
  toUser,
  monthsAmount,
  premiumPromoOrder,
}) => {
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    closePremiumModal, openInvoice, requestConfetti, openTelegramLink, loadStickers, openStickerSet,
  } = getActions();

  const lang = useLang();
  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [currentSection, setCurrentSection] = useState<ApiPremiumSection | undefined>(initialSection);
  const [selectedSubscriptionOption, setSubscriptionOption] = useState<ApiPremiumSubscriptionOption>();

  useEffect(() => {
    if (!isOpen) {
      setHeaderHidden(true);
      setCurrentSection(undefined);
    }
  }, [isOpen]);

  const handleOpenSection = useLastCallback((section: ApiPremiumSection) => {
    setCurrentSection(section);
  });

  const handleResetSection = useLastCallback(() => {
    setCurrentSection(undefined);
  });

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setHeaderHidden(scrollTop <= 150);
  }

  const handleClickWithStartParam = useLastCallback((startParam?: string) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (premiumSlug) {
      openInvoice({
        slug: premiumSlug,
      });
    } else if (premiumBotUsername) {
      openTelegramLink({
        url: `${TME_LINK_PREFIX}${premiumBotUsername}?start=${startParam || 'promo'}`,
      });
      closePremiumModal();
    }
  });

  const handleClick = useLastCallback(() => {
    if (selectedSubscriptionOption) {
      handleClickWithStartParam(String(selectedSubscriptionOption.months));
    } else {
      handleClickWithStartParam();
    }
  });

  const handleChangeSubscriptionOption = useLastCallback((months: number) => {
    const foundOption = promo?.options.find((option) => option.months === months);
    setSubscriptionOption(foundOption);
  });

  const showConfetti = useLastCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      const {
        top, left, width, height,
      } = dialog.querySelector('.modal-content')!.getBoundingClientRect();
      requestConfetti({
        top,
        left,
        width,
        height,
      });
    }
  });

  useEffect(() => {
    if (isSuccess) {
      showConfetti();
    }
  }, [isSuccess, showConfetti]);

  useSyncEffect(([prevIsPremium]) => {
    if (prevIsPremium === isPremium) return;

    showConfetti();
  }, [isPremium, showConfetti]);

  const filteredSections = useMemo(() => {
    if (!premiumPromoOrder) return PREMIUM_FEATURE_SECTIONS;
    return premiumPromoOrder.filter((section) => PREMIUM_FEATURE_SECTIONS.includes(section));
  }, [premiumPromoOrder]);

  useEffect(() => {
    if (!fromUserStatusEmoji || fromUserStatusSet) return;
    loadStickers({
      stickerSetInfo: fromUserStatusEmoji.stickerSetInfo,
    });
  }, [loadStickers, fromUserStatusEmoji, fromUserStatusSet]);

  useEffect(() => {
    const [defaultOption] = promo?.options ?? [];
    setSubscriptionOption(defaultOption);
  }, [promo]);

  const handleOpenStatusSet = useLastCallback(() => {
    if (!fromUserStatusSet) return;

    openStickerSet({
      stickerSetInfo: fromUserStatusSet,
    });
  });

  const stickerSetTitle = useMemo(() => {
    if (!fromUserStatusSet || !fromUser) return undefined;

    const template = lang('lng_premium_emoji_status_title').replace('{user}', getUserFullName(fromUser)!);
    const [first, second] = template.split('{link}');

    const emoji = fromUserStatusSet.thumbCustomEmojiId ? (
      <CustomEmoji className={styles.stickerSetLinkIcon} documentId={fromUserStatusSet.thumbCustomEmojiId} />
    ) : undefined;
    const link = (
      <span className={styles.stickerSetLink} onClick={handleOpenStatusSet}>
        {emoji}{renderText(fromUserStatusSet.title)}
      </span>
    );
    return [renderText(first), link, renderText(second)];
  }, [fromUser, fromUserStatusSet, lang]);

  const fullMonthlyAmount = useMemo(() => {
    const monthOption = promo?.options.find((option) => option.months === 1);
    if (!monthOption) {
      return undefined;
    }
    return Number(monthOption.amount);
  }, [promo]);

  const subscribeButtonText = useMemo(() => {
    if (!selectedSubscriptionOption) {
      return undefined;
    }
    const { amount, months, currency } = selectedSubscriptionOption;
    const perMonthPrice = Math.floor(amount / months);
    return formatCurrency(
      perMonthPrice,
      currency,
      lang.code,
    );
  }, [selectedSubscriptionOption, lang.code]);

  if (!promo || (fromUserStatusEmoji && !fromUserStatusSet)) return undefined;

  function getHeaderText() {
    if (isGift) {
      return fromUser?.id === currentUserId
        ? lang('TelegramPremiumUserGiftedPremiumOutboundDialogTitle', [getUserFullName(toUser), monthsAmount])
        : lang('TelegramPremiumUserGiftedPremiumDialogTitle', [getUserFullName(fromUser), monthsAmount]);
    }

    return fromUser
      ? lang('TelegramPremiumUserDialogTitle', getUserFullName(fromUser))
      : lang(isPremium ? 'TelegramPremiumSubscribedTitle' : 'TelegramPremium');
  }

  function getHeaderDescription() {
    if (isGift) {
      return fromUser?.id === currentUserId
        ? lang('TelegramPremiumUserGiftedPremiumOutboundDialogSubtitle', getUserFullName(toUser))
        : lang('TelegramPremiumUserGiftedPremiumDialogSubtitle');
    }

    if (fromUserStatusSet) {
      return lang('TelegramPremiumUserStatusDialogSubtitle');
    }

    return fromUser
      ? lang('TelegramPremiumUserDialogSubtitle')
      : lang(isPremium ? 'TelegramPremiumSubscribedSubtitle' : 'TelegramPremiumSubtitle');
  }

  function renderFooterText() {
    if (!promo || (isGift && fromUser?.id === currentUserId)) {
      return undefined;
    }

    return (
      <div className={styles.footerText} dir={lang.isRtl ? 'rtl' : undefined}>
        {renderTextWithEntities({
          text: promo.statusText,
          entities: promo.statusEntities,
        })}
      </div>
    );
  }

  function renderSubscriptionOptions() {
    return (
      <div className={styles.subscriptionOptions}>
        {promo?.options
          .map((option) => (
            <PremiumSubscriptionOption
              className={styles.subscriptionOption}
              key={option.amount}
              option={option}
              onChange={handleChangeSubscriptionOption}
              fullMonthlyAmount={fullMonthlyAmount}
              checked={selectedSubscriptionOption?.months === option.months}
            />
          ))}
      </div>
    );
  }

  return (
    <Modal
      className={styles.root}
      onClose={closePremiumModal}
      isOpen={isOpen}
      dialogRef={dialogRef}
    >
      <Transition name="slide" activeKey={currentSection ? 1 : 0} className={styles.transition}>
        {!currentSection ? (
          <div className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
            <Button
              round
              size="smaller"
              className={styles.closeButton}
              color="translucent"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => closePremiumModal()}
              ariaLabel={lang('Close')}
            >
              <i className="icon icon-close" />
            </Button>
            {fromUserStatusEmoji ? (
              <CustomEmoji
                className={styles.statusEmoji}
                onClick={handleOpenStatusSet}
                documentId={fromUserStatusEmoji.id}
                isBig
                size={STATUS_EMOJI_SIZE}
              />
            ) : (
              <img className={styles.logo} src={PremiumLogo} alt="" draggable={false} />
            )}
            <h2 className={buildClassName(styles.headerText, fromUserStatusSet && styles.stickerSetText)}>
              {fromUserStatusSet ? stickerSetTitle : renderText(getHeaderText(), ['simple_markdown', 'emoji'])}
            </h2>
            <div className={styles.description}>
              {renderText(getHeaderDescription(), ['simple_markdown', 'emoji'])}
            </div>
            {!isPremium && renderSubscriptionOptions()}
            <div className={buildClassName(styles.header, isHeaderHidden && styles.hiddenHeader)}>
              <h2 className={styles.premiumHeaderText}>
                {lang('TelegramPremium')}
              </h2>
            </div>
            <div className={buildClassName(styles.list, isPremium && styles.noButton)}>
              {filteredSections.map((section, index) => {
                return (
                  <PremiumFeatureItem
                    key={section}
                    title={lang(PREMIUM_FEATURE_TITLES[section])}
                    text={section === 'double_limits'
                      ? lang(PREMIUM_FEATURE_DESCRIPTIONS[section],
                        [limitChannels, limitFolders, limitPins, limitLinks, LIMIT_ACCOUNTS])
                      : lang(PREMIUM_FEATURE_DESCRIPTIONS[section])}
                    icon={PREMIUM_FEATURE_COLOR_ICONS[section]}
                    index={index}
                    count={filteredSections.length}
                    section={section}
                    onClick={handleOpenSection}
                  />
                );
              })}
              <div
                className={buildClassName(styles.footerText, styles.primaryFooterText)}
                dir={lang.isRtl ? 'rtl' : undefined}
              >
                <p>
                  {renderText(lang('AboutPremiumDescription'), ['simple_markdown'])}
                </p>
                <p>
                  {renderText(lang('AboutPremiumDescription2'), ['simple_markdown'])}
                </p>
              </div>
              {renderFooterText()}
            </div>
            {!isPremium && selectedSubscriptionOption && (
              <div className={styles.footer}>
                <Button className={styles.button} isShiny withPremiumGradient onClick={handleClick}>
                  {lang('SubscribeToPremium', subscribeButtonText)}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <PremiumFeatureModal
            initialSection={currentSection}
            onBack={handleResetSection}
            promo={promo}
            onClickSubscribe={handleClickWithStartParam}
            isPremium={isPremium}
            limits={limits}
            premiumPromoOrder={premiumPromoOrder}
            subscriptionOption={selectedSubscriptionOption}
          />
        )}
      </Transition>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    premiumModal,
  } = selectTabState(global);

  const fromUser = premiumModal?.fromUserId ? selectUser(global, premiumModal.fromUserId) : undefined;
  const fromUserStatusEmoji = fromUser?.emojiStatus ? global.customEmojis.byId[fromUser.emojiStatus.documentId]
    : undefined;
  const fromUserStatusSet = fromUserStatusEmoji ? selectStickerSet(global, fromUserStatusEmoji.stickerSetInfo)
    : undefined;

  return {
    currentUserId: global.currentUserId,
    promo: premiumModal?.promo,
    isSuccess: premiumModal?.isSuccess,
    isGift: premiumModal?.isGift,
    monthsAmount: premiumModal?.monthsAmount,
    fromUser,
    fromUserStatusEmoji,
    fromUserStatusSet,
    toUser: premiumModal?.toUserId ? selectUser(global, premiumModal.toUserId) : undefined,
    initialSection: premiumModal?.initialSection,
    isPremium: selectIsCurrentUserPremium(global),
    limitChannels: selectPremiumLimit(global, 'channels'),
    limitFolders: selectPremiumLimit(global, 'dialogFilters'),
    limitPins: selectPremiumLimit(global, 'dialogFolderPinned'),
    limitLinks: selectPremiumLimit(global, 'channelsPublic'),
    limits: global.appConfig?.limits,
    premiumSlug: global.appConfig?.premiumInvoiceSlug,
    premiumBotUsername: global.appConfig?.premiumBotUsername,
    premiumPromoOrder: global.appConfig?.premiumPromoOrder,
  };
})(PremiumMainModal));
