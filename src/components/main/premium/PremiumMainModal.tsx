import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiPremiumPromo, ApiUser } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import PremiumFeatureModal, {
  PREMIUM_FEATURE_DESCRIPTIONS,
  PREMIUM_FEATURE_SECTIONS,
  PREMIUM_FEATURE_TITLES,
} from './PremiumFeatureModal';
import { TME_LINK_PREFIX } from '../../../config';
import { formatCurrency } from '../../../util/formatCurrency';
import buildClassName from '../../../util/buildClassName';
import { selectIsCurrentUserPremium, selectUser } from '../../../global/selectors';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';
import { selectPremiumLimit } from '../../../global/selectors/limits';
import renderText from '../../common/helpers/renderText';
import { getUserFullName } from '../../../global/helpers';

import useLang from '../../../hooks/useLang';
import useOnChange from '../../../hooks/useOnChange';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import PremiumFeatureItem from './PremiumFeatureItem';
import Transition from '../../ui/Transition';

import PremiumLogo from '../../../assets/premium/PremiumLogo.svg';
import PremiumLimits from '../../../assets/premium/PremiumLimits.svg';
import PremiumFile from '../../../assets/premium/PremiumFile.svg';
import PremiumSpeed from '../../../assets/premium/PremiumSpeed.svg';
import PremiumVoice from '../../../assets/premium/PremiumVoice.svg';
import PremiumAds from '../../../assets/premium/PremiumAds.svg';
import PremiumReactions from '../../../assets/premium/PremiumReactions.svg';
import PremiumStickers from '../../../assets/premium/PremiumStickers.svg';
import PremiumChats from '../../../assets/premium/PremiumChats.svg';
import PremiumBadge from '../../../assets/premium/PremiumBadge.svg';
import PremiumVideo from '../../../assets/premium/PremiumVideo.svg';
import PremiumEmoji from '../../../assets/premium/PremiumEmoji.svg';

import styles from './PremiumMainModal.module.scss';

const LIMIT_ACCOUNTS = 4;

const PREMIUM_FEATURE_COLOR_ICONS: Record<string, string> = {
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
};

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  currentUserId?: string;
  promo?: ApiPremiumPromo;
  isClosing?: boolean;
  fromUser?: ApiUser;
  toUser?: ApiUser;
  initialSection?: string;
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
  premiumPromoOrder?: string[];
};

const PremiumMainModal: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  fromUser,
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
  isClosing,
  isSuccess,
  isGift,
  toUser,
  monthsAmount,
  premiumPromoOrder,
}) => {
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    closePremiumModal, openInvoice, requestConfetti, openTelegramLink,
  } = getActions();

  const lang = useLang();
  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [currentSection, setCurrentSection] = useState<string | undefined>(initialSection);

  const handleOpen = useCallback((section: string | undefined) => {
    return () => {
      setCurrentSection(section);
    };
  }, []);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setHeaderHidden(scrollTop <= 150);
  }

  function handleClickWithStartParam(startParam?: string) {
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
  }

  function handleClick() {
    handleClickWithStartParam();
  }

  const showConfetti = useCallback(() => {
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
  }, [isOpen, requestConfetti]);

  useEffect(() => {
    if (isSuccess) {
      showConfetti();
    }
  }, [isSuccess, showConfetti]);

  useOnChange(([prevIsPremium]) => {
    if (prevIsPremium === isPremium) return;

    showConfetti();
  }, [isPremium]);

  if (!promo) return undefined;

  // TODO Support all subscription options
  const month = promo.options.find((option) => option.months === 1)!;

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
        {renderTextWithEntities(promo.statusText, promo.statusEntities)}
      </div>
    );
  }

  return (
    <Modal
      className={styles.root}
      // eslint-disable-next-line react/jsx-no-bind
      onCloseAnimationEnd={() => closePremiumModal({ isClosed: true })}
      onClose={closePremiumModal}
      isOpen={isOpen && !isClosing}
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
              <i className="icon-close" />
            </Button>
            <img className={styles.logo} src={PremiumLogo} alt="" />
            <h2 className={styles.headerText}>
              {renderText(getHeaderText(), ['simple_markdown', 'emoji'])}
            </h2>
            <div className={styles.description}>
              {renderText(getHeaderDescription(), ['simple_markdown', 'emoji'])}
            </div>
            <div className={buildClassName(styles.header, isHeaderHidden && styles.hiddenHeader)}>
              <h2 className={styles.premiumHeaderText}>
                {lang('TelegramPremium')}
              </h2>
            </div>

            <div className={buildClassName(styles.list, isPremium && styles.noButton)}>
              {(premiumPromoOrder || PREMIUM_FEATURE_SECTIONS).map((section, index) => {
                if (!PREMIUM_FEATURE_SECTIONS.includes(section)) return undefined;
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
                    onClick={handleOpen(section)}
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
            {!isPremium && (
              <div className={styles.footer}>
                {/* eslint-disable-next-line react/jsx-no-bind */}
                <Button className={styles.button} isShiny withPremiumGradient onClick={handleClick}>
                  {lang('SubscribeToPremium', formatCurrency(Number(month.amount), month.currency, lang.code))}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <PremiumFeatureModal
            initialSection={currentSection}
            onBack={handleOpen(undefined)}
            promo={promo}
            // eslint-disable-next-line react/jsx-no-bind
            onClickSubscribe={handleClickWithStartParam}
            isPremium={isPremium}
            limits={limits}
          />
        )}
      </Transition>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    currentUserId: global.currentUserId,
    promo: global.premiumModal?.promo,
    isClosing: global.premiumModal?.isClosing,
    isSuccess: global.premiumModal?.isSuccess,
    isGift: global.premiumModal?.isGift,
    monthsAmount: global.premiumModal?.monthsAmount,
    fromUser: global.premiumModal?.fromUserId ? selectUser(global, global.premiumModal.fromUserId) : undefined,
    toUser: global.premiumModal?.toUserId ? selectUser(global, global.premiumModal.toUserId) : undefined,
    initialSection: global.premiumModal?.initialSection,
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
