import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { toggleExtraClass } from '../../../lib/teact/teact-dom';

import type { ApiPremiumPromo, ApiPremiumSubscriptionOption } from '../../../api/types';
import type { ApiLimitTypeForPromo, ApiPremiumSection, GlobalState } from '../../../global/types';

import { PREMIUM_BOTTOM_VIDEOS, PREMIUM_FEATURE_SECTIONS, PREMIUM_LIMITS_ORDER } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevious from '../../../hooks/usePrevious';

import SliderDots from '../../common/SliderDots';
import Button from '../../ui/Button';
import PremiumLimitPreview from './common/PremiumLimitPreview';
import PremiumFeaturePreviewStickers from './previews/PremiumFeaturePreviewStickers';
import PremiumFeaturePreviewStories from './previews/PremiumFeaturePreviewStories';
import PremiumFeaturePreviewVideo from './previews/PremiumFeaturePreviewVideo';

import styles from './PremiumFeatureModal.module.scss';

export const PREMIUM_FEATURE_TITLES: Record<ApiPremiumSection, string> = {
  double_limits: 'PremiumPreviewLimits',
  infinite_reactions: 'PremiumPreviewReactions2',
  premium_stickers: 'PremiumPreviewStickers',
  animated_emoji: 'PremiumPreviewEmoji',
  no_ads: 'PremiumPreviewNoAds',
  voice_to_text: 'PremiumPreviewVoiceToText',
  profile_badge: 'PremiumPreviewProfileBadge',
  faster_download: 'PremiumPreviewDownloadSpeed',
  more_upload: 'PremiumPreviewUploads',
  advanced_chat_management: 'PremiumPreviewAdvancedChatManagement',
  animated_userpics: 'PremiumPreviewAnimatedProfiles',
  emoji_status: 'PremiumPreviewEmojiStatus',
  translations: 'PremiumPreviewTranslations',
  stories: 'PremiumPreviewStories',
  saved_tags: 'PremiumPreviewTags2',
  last_seen: 'PremiumPreviewLastSeen',
  message_privacy: 'PremiumPreviewMessagePrivacy',
};

export const PREMIUM_FEATURE_DESCRIPTIONS: Record<ApiPremiumSection, string> = {
  double_limits: 'PremiumPreviewLimitsDescription',
  infinite_reactions: 'PremiumPreviewReactions2Description',
  premium_stickers: 'PremiumPreviewStickersDescription',
  no_ads: 'PremiumPreviewNoAdsDescription',
  animated_emoji: 'PremiumPreviewEmojiDescription',
  voice_to_text: 'PremiumPreviewVoiceToTextDescription',
  profile_badge: 'PremiumPreviewProfileBadgeDescription',
  faster_download: 'PremiumPreviewDownloadSpeedDescription',
  more_upload: 'PremiumPreviewUploadsDescription',
  advanced_chat_management: 'PremiumPreviewAdvancedChatManagementDescription',
  animated_userpics: 'PremiumPreviewAnimatedProfilesDescription',
  emoji_status: 'PremiumPreviewEmojiStatusDescription',
  translations: 'PremiumPreviewTranslationsDescription',
  stories: 'PremiumPreviewStoriesDescription',
  saved_tags: 'PremiumPreviewTagsDescription2',
  last_seen: 'PremiumPreviewLastSeenDescription',
  message_privacy: 'PremiumPreviewMessagePrivacyDescription',
};

const LIMITS_TITLES: Record<ApiLimitTypeForPromo, string> = {
  channels: 'GroupsAndChannelsLimitTitle',
  dialogFolderPinned: 'PinChatsLimitTitle',
  channelsPublic: 'PublicLinksLimitTitle',
  savedGifs: 'SavedGifsLimitTitle',
  stickersFaved: 'FavoriteStickersLimitTitle',
  aboutLength: 'BioLimitTitle',
  captionLength: 'CaptionsLimitTitle',
  dialogFilters: 'FoldersLimitTitle',
  dialogFiltersChats: 'ChatPerFolderLimitTitle',
  recommendedChannels: 'SimilarChannelsLimitTitle',
};

const LIMITS_DESCRIPTIONS: Record<ApiLimitTypeForPromo, string> = {
  channels: 'GroupsAndChannelsLimitSubtitle',
  dialogFolderPinned: 'PinChatsLimitSubtitle',
  channelsPublic: 'PublicLinksLimitSubtitle',
  savedGifs: 'SavedGifsLimitSubtitle',
  stickersFaved: 'FavoriteStickersLimitSubtitle',
  aboutLength: 'BioLimitSubtitle',
  captionLength: 'CaptionsLimitSubtitle',
  dialogFilters: 'FoldersLimitSubtitle',
  dialogFiltersChats: 'ChatPerFolderLimitSubtitle',
  recommendedChannels: 'SimilarChannelsLimitSubtitle',
};

const BORDER_THRESHOLD = 20;

type OwnProps = {
  initialSection: ApiPremiumSection;
  promo: ApiPremiumPromo;
  isPremium?: boolean;
  limits?: NonNullable<GlobalState['appConfig']>['limits'];
  premiumPromoOrder?: ApiPremiumSection[];
  subscriptionOption?: ApiPremiumSubscriptionOption;
  onBack: VoidFunction;
  onClickSubscribe: (startParam?: string) => void;
};

const PremiumFeatureModal: FC<OwnProps> = ({
  promo,
  initialSection,
  isPremium,
  limits,
  premiumPromoOrder,
  subscriptionOption,
  onBack,
  onClickSubscribe,
}) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(PREMIUM_FEATURE_SECTIONS.indexOf(initialSection));
  const [reverseAnimationSlideIndex, setReverseAnimationSlideIndex] = useState(0);
  const [isScrolling, startScrolling, stopScrolling] = useFlag();

  const [isScrolledToTop, setIsScrolledToTop] = useState(true);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  const prevInitialSection = usePrevious(initialSection);

  const filteredSections = useMemo(() => {
    if (!premiumPromoOrder) return PREMIUM_FEATURE_SECTIONS;
    return premiumPromoOrder.filter((section) => PREMIUM_FEATURE_SECTIONS.includes(section));
  }, [premiumPromoOrder]);

  const subscriptionButtonText = useMemo(() => {
    if (!subscriptionOption) return undefined;

    const { amount, months, currency } = subscriptionOption;
    const perMonthPrice = Math.floor(amount / months);

    return isPremium ? lang('OK') : lang('SubscribeToPremium', formatCurrency(perMonthPrice, currency, lang.code));
  }, [isPremium, lang, subscriptionOption]);

  const handleClick = useLastCallback(() => {
    onClickSubscribe(initialSection);
  });

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const target = e.currentTarget;
    const { clientWidth, scrollLeft: scrollLeftOriginal } = target;

    const scrollLeft = Math.round(scrollLeftOriginal);

    const left = scrollLeft % (clientWidth);
    const progress = left / (clientWidth);

    const reverseIndex = Math.ceil((scrollLeft + 1) / clientWidth);

    setReverseAnimationSlideIndex(reverseIndex);

    const prevElement = target.querySelector<HTMLDivElement>(`#premium_feature_preview_video_${reverseIndex - 1}`);
    const reverseElement = target.querySelector<HTMLDivElement>(`#premium_feature_preview_video_${reverseIndex}`);

    requestMutation(() => {
      target.style.setProperty('--scroll-progress', progress.toString());
      target.style.setProperty('--abs-scroll-progress', Math.abs(progress).toString());

      if (prevElement) toggleExtraClass(prevElement, 'reverse', false);
      if (reverseElement) toggleExtraClass(reverseElement, 'reverse', true);
    });

    if (isScrolling) return;
    const slide = Math.round(scrollLeft / clientWidth);
    setCurrentSlideIndex(slide);
  }

  function handleLimitsScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    setIsScrolledToTop(scrollTop <= BORDER_THRESHOLD);
    setIsScrolledToBottom(scrollTop >= scrollHeight - clientHeight - BORDER_THRESHOLD);
  }

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || (prevInitialSection === initialSection)) return;

    const index = filteredSections.indexOf(initialSection);
    setCurrentSlideIndex(index);
    startScrolling();
    animateHorizontalScroll(scrollContainer, scrollContainer.clientWidth * index, 0)
      .then(stopScrolling);
  }, [currentSlideIndex, filteredSections, initialSection, prevInitialSection]);

  const handleSelectSlide = useLastCallback(async (index: number) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    setCurrentSlideIndex(index);

    startScrolling();
    await animateHorizontalScroll(scrollContainer, scrollContainer.clientWidth * index, 800);
    stopScrolling();
  });

  return (
    <div className={styles.root}>
      <Button
        round
        size="smaller"
        className={buildClassName(styles.backButton, currentSlideIndex !== 0 && styles.whiteBackButton)}
        color={currentSlideIndex === 0 ? 'translucent' : 'translucent-white'}
        onClick={onBack}
        ariaLabel={lang('Back')}
      >
        <i className="icon icon-arrow-left" />
      </Button>

      <div className={styles.preview} />

      <div className={buildClassName(styles.content, 'no-scrollbar')} onScroll={handleScroll} ref={scrollContainerRef}>

        {filteredSections.map((section, index) => {
          if (section === 'double_limits') {
            return (
              <div className={buildClassName(styles.slide, styles.limits)}>
                <h2 className={buildClassName(styles.header, isScrolledToTop && styles.noHeaderBorder)}>
                  {lang(PREMIUM_FEATURE_TITLES.double_limits)}
                </h2>
                <div className={buildClassName(styles.limitsContent, 'custom-scroll')} onScroll={handleLimitsScroll}>
                  {PREMIUM_LIMITS_ORDER.map((limit, i) => {
                    const defaultLimit = limits?.[limit][0].toString();
                    const premiumLimit = limits?.[limit][1].toString();
                    return (
                      <PremiumLimitPreview
                        title={lang(LIMITS_TITLES[limit])}
                        description={lang(LIMITS_DESCRIPTIONS[limit], premiumLimit)}
                        leftValue={defaultLimit}
                        rightValue={premiumLimit}
                        colorStepProgress={i / (PREMIUM_LIMITS_ORDER.length - 1)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          }

          if (section === 'premium_stickers') {
            return (
              <div className={styles.slide}>
                <div className={styles.frame}>
                  <PremiumFeaturePreviewStickers isActive={currentSlideIndex === index} />
                </div>
                <h1 className={styles.title}>
                  {lang(PREMIUM_FEATURE_TITLES.premium_stickers)}
                </h1>
                <div className={styles.description}>
                  {renderText(lang(PREMIUM_FEATURE_DESCRIPTIONS.premium_stickers), ['br'])}
                </div>
              </div>
            );
          }

          if (section === 'stories') {
            return (
              <div className={buildClassName(styles.slide, styles.stories)}>
                <PremiumFeaturePreviewStories />
              </div>
            );
          }

          const i = promo.videoSections.indexOf(section);
          if (i === -1) return undefined;
          return (
            <div className={styles.slide}>
              <div className={styles.frame}>
                <PremiumFeaturePreviewVideo
                  isActive={currentSlideIndex === index}
                  videoId={promo.videos[i].id!}
                  videoThumbnail={promo.videos[i].thumbnail!}
                  isDown={PREMIUM_BOTTOM_VIDEOS.includes(section)}
                  index={index}
                  isReverseAnimation={index === reverseAnimationSlideIndex}
                />
              </div>
              <h1 className={styles.title}>
                {lang(PREMIUM_FEATURE_TITLES[promo.videoSections[i]!])}
              </h1>
              <div className={styles.description}>
                {renderText(lang(PREMIUM_FEATURE_DESCRIPTIONS[promo.videoSections[i]!]), ['br'])}
              </div>
            </div>
          );
        })}

      </div>

      <div
        className={buildClassName(
          styles.footer,
          (isScrolledToBottom || currentSlideIndex !== 0) && styles.noFooterBorder,
        )}
      >
        <SliderDots
          length={PREMIUM_FEATURE_SECTIONS.length}
          active={currentSlideIndex}
          onSelectSlide={handleSelectSlide}
        />
        {subscriptionButtonText && (
          <Button
            className={buildClassName(styles.button)}
            isShiny={!isPremium}
            withPremiumGradient={!isPremium}
            onClick={isPremium ? onBack : handleClick}
          >
            {subscriptionButtonText}
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(PremiumFeatureModal);
