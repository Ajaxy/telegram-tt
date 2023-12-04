import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiPremiumPromo } from '../../../api/types';
import type { ApiLimitType, GlobalState } from '../../../global/types';

import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import usePrevious from '../../../hooks/usePrevious';

import SliderDots from '../../common/SliderDots';
import Button from '../../ui/Button';
import PremiumLimitPreview from './common/PremiumLimitPreview';
import PremiumFeaturePreviewStickers from './previews/PremiumFeaturePreviewStickers';
import PremiumFeaturePreviewStories from './previews/PremiumFeaturePreviewStories';
import PremiumFeaturePreviewVideo from './previews/PremiumFeaturePreviewVideo';

import styles from './PremiumFeatureModal.module.scss';

export const PREMIUM_FEATURE_TITLES: Record<string, string> = {
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
};

export const PREMIUM_FEATURE_DESCRIPTIONS: Record<string, string> = {
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
};

export const PREMIUM_FEATURE_SECTIONS = [
  'stories',
  'double_limits',
  'more_upload',
  'faster_download',
  'voice_to_text',
  'no_ads',
  'infinite_reactions',
  'premium_stickers',
  'animated_emoji',
  'advanced_chat_management',
  'profile_badge',
  'animated_userpics',
  'emoji_status',
  'translations',
];

const PREMIUM_BOTTOM_VIDEOS: string[] = [
  'faster_download',
  'voice_to_text',
  'advanced_chat_management',
  'infinite_reactions',
  'profile_badge',
  'animated_userpics',
  'emoji_status',
  'translations',
];

type ApiLimitTypeWithoutUpload = Exclude<ApiLimitType, 'uploadMaxFileparts' | 'chatlistInvites' | 'chatlistJoined'>;

const LIMITS_ORDER: ApiLimitTypeWithoutUpload[] = [
  'channels',
  'dialogFolderPinned',
  'channelsPublic',
  'savedGifs',
  'stickersFaved',
  'aboutLength',
  'captionLength',
  'dialogFilters',
  'dialogFiltersChats',
];

const LIMITS_TITLES: Record<ApiLimitTypeWithoutUpload, string> = {
  channels: 'GroupsAndChannelsLimitTitle',
  dialogFolderPinned: 'PinChatsLimitTitle',
  channelsPublic: 'PublicLinksLimitTitle',
  savedGifs: 'SavedGifsLimitTitle',
  stickersFaved: 'FavoriteStickersLimitTitle',
  aboutLength: 'BioLimitTitle',
  captionLength: 'CaptionsLimitTitle',
  dialogFilters: 'FoldersLimitTitle',
  dialogFiltersChats: 'ChatPerFolderLimitTitle',
};

const LIMITS_DESCRIPTIONS: Record<ApiLimitTypeWithoutUpload, string> = {
  channels: 'GroupsAndChannelsLimitSubtitle',
  dialogFolderPinned: 'PinChatsLimitSubtitle',
  channelsPublic: 'PublicLinksLimitSubtitle',
  savedGifs: 'SavedGifsLimitSubtitle',
  stickersFaved: 'FavoriteStickersLimitSubtitle',
  aboutLength: 'BioLimitSubtitle',
  captionLength: 'CaptionsLimitSubtitle',
  dialogFilters: 'FoldersLimitSubtitle',
  dialogFiltersChats: 'ChatPerFolderLimitSubtitle',
};

const BORDER_THRESHOLD = 20;

type OwnProps = {
  initialSection: string;
  promo: ApiPremiumPromo;
  isPremium?: boolean;
  limits?: NonNullable<GlobalState['appConfig']>['limits'];
  premiumPromoOrder?: string[];
  onBack: VoidFunction;
  onClickSubscribe: (startParam?: string) => void;
};

const PremiumFeatureModal: FC<OwnProps> = ({
  promo,
  initialSection,
  isPremium,
  limits,
  premiumPromoOrder,
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

  function handleClick() {
    onClickSubscribe(initialSection);
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { clientWidth, scrollLeft: scrollLeftOriginal } = e.currentTarget;

    const scrollLeft = Math.round(scrollLeftOriginal);

    const left = scrollLeft % (clientWidth);
    const progress = left / (clientWidth);
    e.currentTarget.style.setProperty('--scroll-progress', progress.toString());
    e.currentTarget.style.setProperty('--abs-scroll-progress', Math.abs(progress).toString());
    const reverseIndex = Math.ceil((scrollLeft + 1) / clientWidth);

    setReverseAnimationSlideIndex(reverseIndex);

    const prevElement = e.currentTarget.querySelector(`#premium_feature_preview_video_${reverseIndex - 1}`);
    const reverseElement = e.currentTarget.querySelector(`#premium_feature_preview_video_${reverseIndex}`);
    prevElement?.classList.toggle('reverse', false);
    reverseElement?.classList.toggle('reverse', true);

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

  const handleSelectSlide = useCallback(async (index: number) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    setCurrentSlideIndex(index);

    startScrolling();
    await animateHorizontalScroll(scrollContainer, scrollContainer.clientWidth * index, 800);
    stopScrolling();
  }, []);

  // TODO Support all subscription options
  const month = promo.options.find((option) => option.months === 1)!;

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
                  {LIMITS_ORDER.map((limit, i) => {
                    const defaultLimit = limits?.[limit][0].toString();
                    const premiumLimit = limits?.[limit][1].toString();
                    return (
                      <PremiumLimitPreview
                        title={lang(LIMITS_TITLES[limit])}
                        description={lang(LIMITS_DESCRIPTIONS[limit], premiumLimit)}
                        leftValue={defaultLimit}
                        rightValue={premiumLimit}
                        colorStepProgress={i / (LIMITS_ORDER.length - 1)}
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
        <Button
          className={buildClassName(styles.button)}
          isShiny={!isPremium}
          withPremiumGradient={!isPremium}
          onClick={isPremium ? onBack : handleClick}
        >
          {isPremium
            ? lang('OK')
            : lang('SubscribeToPremium', formatCurrency(Number(month.amount), month.currency, lang.code))}
        </Button>
      </div>
    </div>
  );
};

export default memo(PremiumFeatureModal);
