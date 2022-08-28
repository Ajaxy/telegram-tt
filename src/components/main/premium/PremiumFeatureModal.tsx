import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiPremiumPromo } from '../../../api/types';
import type { ApiLimitType, GlobalState } from '../../../global/types';

import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';
import fastSmoothScrollHorizontal from '../../../util/fastSmoothScrollHorizontal';
import useFlag from '../../../hooks/useFlag';
import renderText from '../../common/helpers/renderText';
import usePrevious from '../../../hooks/usePrevious';
import { formatCurrency } from '../../../util/formatCurrency';

import Button from '../../ui/Button';
import PremiumLimitPreview from './common/PremiumLimitPreview';
import PremiumFeaturePreviewVideo from './previews/PremiumFeaturePreviewVideo';
import PremiumFeaturePreviewReactions from './previews/PremiumFeaturePreviewReactions';
import SliderDots from '../../common/SliderDots';
import PremiumFeaturePreviewStickers from './previews/PremiumFeaturePreviewStickers';

import styles from './PremiumFeatureModal.module.scss';

export const PREMIUM_FEATURE_TITLES: Record<string, string> = {
  limits: 'PremiumPreviewLimits',
  reactions: 'PremiumPreviewReactions',
  stickers: 'PremiumPreviewStickers',
  no_ads: 'PremiumPreviewNoAds',
  voice_to_text: 'PremiumPreviewVoiceToText',
  profile_badge: 'PremiumPreviewProfileBadge',
  faster_download: 'PremiumPreviewDownloadSpeed',
  more_upload: 'PremiumPreviewUploads',
  advanced_chat_management: 'PremiumPreviewAdvancedChatManagement',
  animated_userpics: 'PremiumPreviewAnimatedProfiles',
};

export const PREMIUM_FEATURE_DESCRIPTIONS: Record<string, string> = {
  limits: 'PremiumPreviewLimitsDescription',
  reactions: 'PremiumPreviewReactionsDescription',
  stickers: 'PremiumPreviewStickersDescription',
  no_ads: 'PremiumPreviewNoAdsDescription',
  voice_to_text: 'PremiumPreviewVoiceToTextDescription',
  profile_badge: 'PremiumPreviewProfileBadgeDescription',
  faster_download: 'PremiumPreviewDownloadSpeedDescription',
  more_upload: 'PremiumPreviewUploadsDescription',
  advanced_chat_management: 'PremiumPreviewAdvancedChatManagementDescription',
  animated_userpics: 'PremiumPreviewAnimatedProfilesDescription',
};

export const PREMIUM_FEATURE_SECTIONS = [
  'limits',
  'more_upload',
  'faster_download',
  'voice_to_text',
  'no_ads',
  'reactions',
  'stickers',
  'advanced_chat_management',
  'profile_badge',
  'animated_userpics',
];

const PREMIUM_BOTTOM_VIDEOS: string[] = [
  'faster_download',
  'voice_to_text',
  'advanced_chat_management',
  'profile_badge',
  'animated_userpics',
];

type ApiLimitTypeWithoutUpload = Exclude<ApiLimitType, 'uploadMaxFileparts'>;

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
  onBack: VoidFunction;
  initialSection: string;
  promo: ApiPremiumPromo;
  onClickSubscribe: (startParam?: string) => void;
  isPremium?: boolean;
  limits?: NonNullable<GlobalState['appConfig']>['limits'];
};

const PremiumFeatureModal: FC<OwnProps> = ({
  promo,
  initialSection,
  onBack,
  onClickSubscribe,
  isPremium,
  limits,
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

    const index = PREMIUM_FEATURE_SECTIONS.indexOf(initialSection);
    setCurrentSlideIndex(index);
    startScrolling();
    fastSmoothScrollHorizontal(scrollContainer, scrollContainer.clientWidth * index, 0)
      .then(stopScrolling);
  }, [currentSlideIndex, initialSection, prevInitialSection, startScrolling, stopScrolling]);

  const handleSelectSlide = useCallback(async (index: number) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    setCurrentSlideIndex(index);

    startScrolling();
    await fastSmoothScrollHorizontal(scrollContainer, scrollContainer.clientWidth * index, 800);
    stopScrolling();
  }, [startScrolling, stopScrolling]);

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
        <i className="icon-arrow-left" />
      </Button>

      <div className={styles.preview} />

      <div className={buildClassName(styles.content, 'no-scrollbar')} onScroll={handleScroll} ref={scrollContainerRef}>

        {PREMIUM_FEATURE_SECTIONS.map((section, index) => {
          if (section === 'limits') {
            return (
              <div className={buildClassName(styles.slide, styles.limits)}>
                <h2 className={buildClassName(styles.header, isScrolledToTop && styles.noHeaderBorder)}>
                  {lang(PREMIUM_FEATURE_TITLES.limits)}
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
          if (section === 'reactions') {
            return (
              <div className={styles.slide}>
                <div className={styles.frame}>
                  <PremiumFeaturePreviewReactions isActive={currentSlideIndex === index} />
                </div>
                <h1 className={styles.title}>
                  {lang(PREMIUM_FEATURE_TITLES.reactions)}
                </h1>
                <div className={styles.description}>
                  {renderText(lang(PREMIUM_FEATURE_DESCRIPTIONS.reactions), ['br'])}
                </div>
              </div>
            );
          }

          if (section === 'stickers') {
            return (
              <div className={styles.slide}>
                <div className={styles.frame}>
                  <PremiumFeaturePreviewStickers isActive={currentSlideIndex === index} />
                </div>
                <h1 className={styles.title}>
                  {lang(PREMIUM_FEATURE_TITLES.stickers)}
                </h1>
                <div className={styles.description}>
                  {renderText(lang(PREMIUM_FEATURE_DESCRIPTIONS.stickers), ['br'])}
                </div>
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
          className={buildClassName(styles.button, !isPremium && styles.buttonPremium)}
          isShiny={!isPremium}
          onClick={isPremium ? onBack : handleClick}
        >
          {isPremium
            ? lang('OK')
            : lang('SubscribeToPremium', formatCurrency(Number(promo.monthlyAmount), promo.currency, lang.code))}
        </Button>
      </div>
    </div>
  );
};

export default memo(PremiumFeatureModal);
