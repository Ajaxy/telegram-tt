import type { FC } from '@teact';
import { memo, useEffect, useMemo, useRef, useState } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiPremiumPromo,
  ApiPremiumSection,
  ApiPremiumSubscriptionOption,
  ApiStarGift,
  ApiSticker,
  ApiStickerSet,
  ApiUser,
} from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { LangPair } from '../../../types/language';

import { PREMIUM_FEATURE_SECTIONS, TME_LINK_PREFIX } from '../../../config';
import { getUserFullName } from '../../../global/helpers';
import {
  selectCustomEmoji,
  selectIsCurrentUserPremium,
  selectStickerSet,
  selectTabState,
  selectUser,
} from '../../../global/selectors';
import { selectPremiumLimit } from '../../../global/selectors/limits';
import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import { getStickerFromGift } from '../../common/helpers/gifts';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useSyncEffect from '../../../hooks/useSyncEffect';

import CustomEmoji from '../../common/CustomEmoji';
import Icon from '../../common/icons/Icon';
import ParticlesHeader from '../../modals/common/ParticlesHeader.tsx';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import Transition from '../../ui/Transition';
import PremiumFeatureItem from './PremiumFeatureItem';
import PremiumFeatureModal, { PREMIUM_FEATURE_DESCRIPTIONS, PREMIUM_FEATURE_TITLES } from './PremiumFeatureModal';
import PremiumSubscriptionOption from './PremiumSubscriptionOption';

import styles from './PremiumMainModal.module.scss';

import PremiumAds from '../../../assets/premium/PremiumAds.svg';
import PremiumBadge from '../../../assets/premium/PremiumBadge.svg';
import PremiumChats from '../../../assets/premium/PremiumChats.svg';
import PremiumEffects from '../../../assets/premium/PremiumEffects.svg';
import PremiumEmoji from '../../../assets/premium/PremiumEmoji.svg';
import PremiumFile from '../../../assets/premium/PremiumFile.svg';
import PremiumLastSeen from '../../../assets/premium/PremiumLastSeen.svg';
import PremiumLimits from '../../../assets/premium/PremiumLimits.svg';
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
  effects: PremiumEffects,
  todo: PremiumBadge,
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
  gift?: ApiStarGift;
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
  gift,
}) => {
  const dialogRef = useRef<HTMLDivElement>();
  const {
    closePremiumModal, openInvoice, requestConfetti, openTelegramLink, loadStickers, openStickerSet,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [currentSection, setCurrentSection] = useState<ApiPremiumSection | undefined>(initialSection);
  const [selectedSubscriptionOption, setSubscriptionOption] = useState<ApiPremiumSubscriptionOption>();

  useEffect(() => {
    if (!isOpen) {
      setHeaderHidden(true);
      setCurrentSection(undefined);
    } else if (initialSection) {
      setCurrentSection(initialSection);
    }
  }, [isOpen, initialSection]);

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
        type: 'slug',
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
        withStars: true,
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
      lang,
      perMonthPrice,
      currency,
    );
  }, [selectedSubscriptionOption, lang]);

  if (!promo || (fromUserStatusEmoji && !fromUserStatusSet)) return undefined;

  function getHeaderText() {
    if (gift) {
      return lang('PremiumGiftHeader');
    }

    if (isGift) {
      return renderText(
        fromUser?.id === currentUserId
          ? oldLang('TelegramPremiumUserGiftedPremiumOutboundDialogTitle', [getUserFullName(toUser), monthsAmount])
          : oldLang('TelegramPremiumUserGiftedPremiumDialogTitle', [getUserFullName(fromUser), monthsAmount]),
        ['simple_markdown', 'emoji'],
      );
    }

    if (fromUserStatusSet && fromUser) {
      const template = oldLang('lng_premium_emoji_status_title').replace('{user}', getUserFullName(fromUser)!);
      const [first, second] = template.split('{link}');

      const emoji = fromUserStatusSet.thumbCustomEmojiId ? (
        <CustomEmoji className={styles.stickerSetLinkIcon} documentId={fromUserStatusSet.thumbCustomEmojiId} />
      ) : undefined;
      const link = (
        <span className={styles.stickerSetLink} onClick={handleOpenStatusSet}>
          {emoji}
          {renderText(fromUserStatusSet.title)}
        </span>
      );
      return [renderText(first), link, renderText(second)];
    }

    return renderText(
      fromUser
        ? oldLang('TelegramPremiumUserDialogTitle', getUserFullName(fromUser))
        : oldLang(isPremium ? 'TelegramPremiumSubscribedTitle' : 'TelegramPremium'),
      ['simple_markdown', 'emoji'],
    );
  }

  function getHeaderDescription() {
    if (gift && gift.type !== 'starGiftUnique' && gift.perUserTotal) {
      return lang('DescriptionGiftPremiumRequired2', { count: gift.perUserTotal }, {
        pluralValue: gift.perUserTotal,
      });
    }

    if (isGift) {
      return fromUser?.id === currentUserId
        ? oldLang('TelegramPremiumUserGiftedPremiumOutboundDialogSubtitle', getUserFullName(toUser))
        : oldLang('TelegramPremiumUserGiftedPremiumDialogSubtitle');
    }

    if (fromUserStatusSet) {
      return oldLang('TelegramPremiumUserStatusDialogSubtitle');
    }

    return fromUser
      ? oldLang('TelegramPremiumUserDialogSubtitle')
      : oldLang(isPremium ? 'TelegramPremiumSubscribedSubtitle' : 'TelegramPremiumSubtitle');
  }

  function renderHeader() {
    if (gift) {
      const giftSticker = getStickerFromGift(gift);
      return (
        <ParticlesHeader
          model="sticker"
          sticker={giftSticker}
          color="purple"
          title={getHeaderText()}
          description={renderText(getHeaderDescription(), ['simple_markdown', 'emoji'])}
          className={styles.giftParticlesHeader}
        />
      );
    }

    if (!fromUserStatusEmoji) {
      return (
        <ParticlesHeader
          model="swaying-star"
          color="purple"
          title={getHeaderText()}
          description={renderText(getHeaderDescription(), ['simple_markdown', 'emoji'])}
          className={styles.starParticlesHeader}
        />
      );
    }

    return (
      <>
        <CustomEmoji
          className={styles.statusEmoji}
          onClick={handleOpenStatusSet}
          documentId={fromUserStatusEmoji.id}
          isBig
          size={STATUS_EMOJI_SIZE}
        />
        <h2 className={buildClassName(styles.headerText, fromUserStatusSet && styles.stickerSetText)}>
          {getHeaderText()}
        </h2>
        <div className={styles.description}>
          {renderText(getHeaderDescription(), ['simple_markdown', 'emoji'])}
        </div>
      </>
    );
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
              onClick={() => closePremiumModal()}
              ariaLabel={oldLang('Close')}
            >
              <Icon name="close" />
            </Button>
            {renderHeader()}
            {!isPremium && !isGift && renderSubscriptionOptions()}
            <div className={buildClassName(styles.header, isHeaderHidden && styles.hiddenHeader)}>
              <h2 className={styles.premiumHeaderText}>
                {oldLang('TelegramPremium')}
              </h2>
            </div>
            <div className={buildClassName(styles.list, isPremium && styles.noButton)}>
              {filteredSections.map((section, index) => {
                const shouldUseNewLang = section === 'todo';
                return (
                  <PremiumFeatureItem
                    key={section}
                    title={shouldUseNewLang
                      ? lang(PREMIUM_FEATURE_TITLES[section] as keyof LangPair)
                      : oldLang(PREMIUM_FEATURE_TITLES[section])}
                    text={section === 'double_limits'
                      ? oldLang(PREMIUM_FEATURE_DESCRIPTIONS[section],
                        [limitChannels, limitFolders, limitPins, limitLinks, LIMIT_ACCOUNTS])
                      : shouldUseNewLang
                        ? lang(PREMIUM_FEATURE_DESCRIPTIONS[section] as keyof LangPair)
                        : oldLang(PREMIUM_FEATURE_DESCRIPTIONS[section])}
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
                  {renderText(oldLang('AboutPremiumDescription'), ['simple_markdown'])}
                </p>
                <p>
                  {renderText(oldLang('AboutPremiumDescription2'), ['simple_markdown'])}
                </p>
              </div>
              {renderFooterText()}
            </div>
            {!isPremium && selectedSubscriptionOption && (
              <div className={styles.footer}>
                <Button className={styles.button} isShiny withPremiumGradient onClick={handleClick}>
                  {oldLang('SubscribeToPremium', subscribeButtonText)}
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

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const {
    premiumModal,
  } = selectTabState(global);

  const fromUser = premiumModal?.fromUserId ? selectUser(global, premiumModal.fromUserId) : undefined;
  const fromUserStatusEmoji = fromUser?.emojiStatus ? selectCustomEmoji(global, fromUser.emojiStatus.documentId)
    : undefined;
  const fromUserStatusSet = fromUserStatusEmoji ? selectStickerSet(global, fromUserStatusEmoji.stickerSetInfo)
    : undefined;

  return {
    currentUserId: global.currentUserId,
    promo: premiumModal?.promo,
    isSuccess: premiumModal?.isSuccess,
    isGift: premiumModal?.isGift,
    monthsAmount: premiumModal?.monthsAmount,
    gift: premiumModal?.gift,
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
    limits: global.appConfig.limits,
    premiumSlug: global.appConfig.premiumInvoiceSlug,
    premiumBotUsername: global.appConfig.premiumBotUsername,
    premiumPromoOrder: global.appConfig.premiumPromoOrder,
  };
})(PremiumMainModal));
