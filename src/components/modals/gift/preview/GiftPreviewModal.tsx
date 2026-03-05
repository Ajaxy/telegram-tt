import { memo, useEffect, useMemo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiStarGiftAttributeBackdrop,
  ApiStarGiftAttributeModel,
  ApiStarGiftAttributePattern,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import type { AnimationLevel } from '../../../../types';

import { selectAnimationLevel } from '../../../../global/selectors/sharedState';
import buildClassName from '../../../../util/buildClassName';
import { getNextArrowReplacement } from '../../../../util/localization/format';
import { resolveTransitionName } from '../../../../util/resolveTransitionName';
import { getGiftAttributes, getRandomGiftPreviewAttributes } from '../../../common/helpers/gifts';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import { useIntersectionObserver } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import GiftRarityBadge from '../../../common/GiftRarityBadge';
import Button from '../../../ui/Button';
import InfiniteScroll from '../../../ui/InfiniteScroll';
import Link from '../../../ui/Link';
import Modal from '../../../ui/Modal';
import TabList, { type TabWithProperties } from '../../../ui/TabList';
import Transition from '../../../ui/Transition';
import GiftAttributeItem from '../GiftAttributeItem';
import UniqueGiftHeader from '../UniqueGiftHeader';

import styles from './GiftPreviewModal.module.scss';

export type OwnProps = {
  modal: TabState['giftPreviewModal'];
};

type StateProps = {
  animationLevel: AnimationLevel;
};

const MODEL_STICKER_SIZE = 80;
const PATTERN_STICKER_SIZE = 60;
const INTERSECTION_THROTTLE = 200;

enum AttributeTab {
  Model,
  Backdrop,
  Pattern,
}

const GiftPreviewModal = ({ modal, animationLevel }: OwnProps & StateProps) => {
  const {
    closeGiftPreviewModal,
    openGiftInMarket,
    updateResaleGiftsFilter,
  } = getActions();
  const [isCraftableModelsMode, showCraftableModels, showRegularModels] = useFlag();
  const [isPlayingRandomPreviews, playRandomPreviews, stopRandomPreviews] = useFlag(true);

  const modelsContainerRef = useRef<HTMLDivElement>();
  const patternsContainerRef = useRef<HTMLDivElement>();
  const backdropsContainerRef = useRef<HTMLDivElement>();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const originGift = renderingModal?.originGift;
  const initialAttributes = useMemo(() => originGift && getGiftAttributes(originGift), [originGift]);

  const lang = useLang();

  const [selectedTabIndex, setSelectedTabIndex] = useState(AttributeTab.Model);

  const { regularModels, craftableModels, patterns, backdrops } = useMemo(() => {
    if (!renderingModal?.attributes) {
      return { regularModels: [], craftableModels: [], patterns: [], backdrops: [] };
    }

    const result: {
      regularModels: ApiStarGiftAttributeModel[];
      craftableModels: ApiStarGiftAttributeModel[];
      patterns: ApiStarGiftAttributePattern[];
      backdrops: ApiStarGiftAttributeBackdrop[];
    } = { regularModels: [], craftableModels: [], patterns: [], backdrops: [] };

    for (const attr of renderingModal.attributes) {
      if (attr.type === 'model') {
        if (attr.rarity.type === 'regular') {
          result.regularModels.push(attr);
        } else {
          result.craftableModels.push(attr);
        }
      }
      if (attr.type === 'pattern') result.patterns.push(attr);
      if (attr.type === 'backdrop') result.backdrops.push(attr);
    }

    return result;
  }, [renderingModal?.attributes]);

  const firstModel = regularModels[0];
  const firstPattern = patterns[0];
  const firstBackdrop = backdrops[0];

  const [selectedModel, setSelectedModel] = useState<ApiStarGiftAttributeModel | undefined>(firstModel);
  const [selectedPattern, setSelectedPattern] = useState<ApiStarGiftAttributePattern | undefined>(firstPattern);
  const [selectedBackdrop, setSelectedBackdrop] = useState<ApiStarGiftAttributeBackdrop | undefined>(firstBackdrop);

  useEffect(() => {
    if (isOpen) return;
    setSelectedTabIndex(AttributeTab.Model);
    showRegularModels();
  }, [isOpen]);

  useEffect(() => {
    const newModel = initialAttributes?.model || firstModel;
    setSelectedModel(newModel);
    setSelectedPattern(initialAttributes?.pattern || firstPattern);
    setSelectedBackdrop(initialAttributes?.backdrop || firstBackdrop);
    if (newModel && newModel.rarity.type !== 'regular') showCraftableModels();
  }, [initialAttributes, firstModel, firstPattern, firstBackdrop]);

  useEffect(() => {
    if (renderingModal?.shouldShowCraftableOnStart) {
      showCraftableModels();
    }
  }, [renderingModal?.shouldShowCraftableOnStart]);

  const handleStickerAnimationEnded = useLastCallback((modelName: string) => {
    if (modelName !== selectedModel?.name || !isPlayingRandomPreviews) return;

    if (!originGift || !selectedModel || !selectedPattern || !selectedBackdrop) return;
    const attributesToUse = renderingModal?.shouldShowCraftableOnStart && isCraftableModelsMode
      ? renderingModal.attributes.filter((attr) => attr.type !== 'model' || attr.rarity.type !== 'regular')
      : renderingModal?.attributes;
    const newAttributes = getRandomGiftPreviewAttributes(attributesToUse, {
      model: selectedModel,
      pattern: selectedPattern,
      backdrop: selectedBackdrop,
    });
    setSelectedModel(newAttributes.model);
    setSelectedPattern(newAttributes.pattern);
    setSelectedBackdrop(newAttributes.backdrop);
  });

  const {
    observe: observeModelsIntersection,
  } = useIntersectionObserver({
    rootRef: modelsContainerRef,
    throttleMs: INTERSECTION_THROTTLE,
    isDisabled: selectedTabIndex !== AttributeTab.Model,
  });

  const {
    observe: observePatternsIntersection,
  } = useIntersectionObserver({
    rootRef: patternsContainerRef,
    throttleMs: INTERSECTION_THROTTLE,
    isDisabled: selectedTabIndex !== AttributeTab.Pattern,
  });

  const {
    observe: observeBackdropsIntersection,
  } = useIntersectionObserver({
    rootRef: backdropsContainerRef,
    throttleMs: INTERSECTION_THROTTLE,
    isDisabled: selectedTabIndex !== AttributeTab.Backdrop,
  });

  const tabs = useMemo<TabWithProperties[]>(() => [
    { title: lang('GiftAttributeModel') },
    { title: lang('GiftAttributeBackdrop') },
    { title: lang('GiftAttributeSymbol') },
  ], [lang]);

  const handleClose = useLastCallback(() => closeGiftPreviewModal());

  const handleSelectModel = useLastCallback((model: ApiStarGiftAttributeModel) => {
    setSelectedModel(model);
    stopRandomPreviews();
  });

  const handleSelectPattern = useLastCallback((pattern: ApiStarGiftAttributePattern) => {
    setSelectedPattern(pattern);
    stopRandomPreviews();
  });

  const handleSelectBackdrop = useLastCallback((backdrop: ApiStarGiftAttributeBackdrop) => {
    setSelectedBackdrop(backdrop);
    stopRandomPreviews();
  });

  const handleSymbolClick = useLastCallback(() => {
    if (!originGift || !selectedPattern) return;

    openGiftInMarket({ gift: originGift });
    updateResaleGiftsFilter({
      filter: {
        sortType: 'byDate',
        modelAttributes: [],
        backdropAttributes: [],
        patternAttributes: [{
          type: 'pattern',
          documentId: selectedPattern.sticker.id,
        }],
      },
    });
    handleClose();
  });

  const handleBackdropClick = useLastCallback(() => {
    if (!originGift || !selectedBackdrop) return;

    openGiftInMarket({ gift: originGift });
    updateResaleGiftsFilter({
      filter: {
        sortType: 'byDate',
        modelAttributes: [],
        backdropAttributes: [{
          type: 'backdrop',
          backdropId: selectedBackdrop.backdropId,
        }],
        patternAttributes: [],
      },
    });
    handleClose();
  });

  const handleModelClick = useLastCallback(() => {
    if (!originGift) return;

    openGiftInMarket({ gift: originGift });
    updateResaleGiftsFilter({
      filter: {
        sortType: 'byDate',
        modelAttributes: [{
          type: 'model',
          documentId: selectedModel!.sticker.id,
        }],
        backdropAttributes: [],
        patternAttributes: [],
      },
    });
    handleClose();
  });

  const modalHeader = useMemo(() => {
    return (
      <>
        <Button
          className="modal-absolute-close-button"
          round
          color="translucent-white"
          size="tiny"
          iconName="close"
          ariaLabel={lang('Close')}
          onClick={handleClose}
        />
        <Button
          className={styles.playButton}
          round
          color="translucent-white"
          size="tiny"
          iconName={isPlayingRandomPreviews ? 'pause' : 'play'}
          ariaLabel={isPlayingRandomPreviews ? lang('AriaGiftPreviewStop') : lang('AriaGiftPreviewPlay')}
          onClick={isPlayingRandomPreviews ? stopRandomPreviews : playRandomPreviews}
        />
      </>
    );
  }, [lang, isPlayingRandomPreviews]);

  function renderHeader() {
    if (!selectedModel || !selectedPattern || !selectedBackdrop) return undefined;
    return (
      <UniqueGiftHeader
        className={styles.header}
        modelAttribute={selectedModel}
        backdropAttribute={selectedBackdrop}
        patternAttribute={selectedPattern}
        title={originGift?.title}
        subtitle={lang('GiftPreviewSelectedTraits')}
        noLoop
        onStickerAnimationEnded={handleStickerAnimationEnded}
      >
        <div
          className={styles.traitButtons}
          style={`--_badge-bg: ${selectedBackdrop.centerColor}`}
        >
          <Button
            className={styles.traitButton}
            color="transparentBlured"
            onClick={handleModelClick}
          >
            <span className={styles.traitName}>{selectedModel.name}</span>
            <span className={styles.traitType}>{lang('GiftAttributeModel')}</span>
            <GiftRarityBadge
              shouldInvertRare
              rarity={selectedModel.rarity}
              className={styles.traitRarity}
            />
          </Button>
          <Button
            className={styles.traitButton}
            color="transparentBlured"
            onClick={handleBackdropClick}
          >
            <span className={styles.traitName}>{selectedBackdrop.name}</span>
            <span className={styles.traitType}>{lang('GiftAttributeBackdrop')}</span>
            <GiftRarityBadge
              shouldInvertRare
              rarity={selectedBackdrop.rarity}
              className={styles.traitRarity}
            />
          </Button>
          <Button
            className={styles.traitButton}
            color="transparentBlured"
            onClick={handleSymbolClick}
          >
            <span className={styles.traitName}>{selectedPattern.name}</span>
            <span className={styles.traitType}>{lang('GiftAttributeSymbol')}</span>
            <GiftRarityBadge
              shouldInvertRare
              rarity={selectedPattern.rarity}
              className={styles.traitRarity}
            />
          </Button>
        </div>
      </UniqueGiftHeader>
    );
  }

  function renderTabContent() {
    switch (selectedTabIndex) {
      case AttributeTab.Model:
        return (
          <InfiniteScroll
            ref={modelsContainerRef}
            className={buildClassName(styles.grid, 'custom-scroll')}
            beforeChildren={(
              <div className={styles.gridHeader}>
                <span className={styles.count}>
                  {lang(
                    isCraftableModelsMode ? 'GiftPreviewCountCraftableModels' : 'GiftPreviewCountModels',
                    { count: isCraftableModelsMode ? craftableModels.length : regularModels.length }, {
                      pluralValue: isCraftableModelsMode ? craftableModels.length : regularModels.length,
                      withNodes: true,
                      withMarkdown: true,
                    })}
                </span>
                {Boolean(craftableModels?.length) && (
                  <Link
                    isPrimary
                    onClick={() => isCraftableModelsMode ? showRegularModels() : showCraftableModels()}
                  >
                    {lang(
                      isCraftableModelsMode ? 'GiftPreviewToggleRegularModels' : 'GiftPreviewToggleCraftableModels',
                      undefined,
                      { withNodes: true, specialReplacement: getNextArrowReplacement() },
                    )}
                  </Link>
                )}
              </div>
            )}
            items={isCraftableModelsMode ? craftableModels : regularModels}
            noFastList
          >
            {(isCraftableModelsMode ? craftableModels : regularModels).map((model) => (
              <GiftAttributeItem
                className={styles.item}
                key={model.name}
                sticker={model.sticker}
                stickerSize={MODEL_STICKER_SIZE}
                rarity={model.rarity}
                isSelected={selectedModel?.name === model.name}
                clickArg={model}
                onClick={handleSelectModel}
                observeIntersection={observeModelsIntersection}
              />
            ))}
          </InfiniteScroll>
        );
      case AttributeTab.Pattern:
        return (
          <InfiniteScroll
            ref={patternsContainerRef}
            className={buildClassName(styles.grid, 'custom-scroll')}
            beforeChildren={(
              <div className={styles.gridHeader}>
                <span className={styles.count}>
                  {lang('GiftPreviewCountPatterns', { count: patterns.length }, {
                    pluralValue: patterns.length,
                    withNodes: true,
                    withMarkdown: true,
                  })}
                </span>
              </div>
            )}
            items={patterns}
            noFastList
          >
            {patterns.map((pattern) => (
              <GiftAttributeItem
                key={pattern.name}
                className={styles.item}
                backdrop={selectedBackdrop}
                sticker={pattern.sticker}
                patternSticker={pattern.sticker}
                stickerNoPlay
                stickerSize={PATTERN_STICKER_SIZE}
                rarity={pattern.rarity}
                isSelected={selectedPattern?.name === pattern.name}
                clickArg={pattern}
                onClick={handleSelectPattern}
                observeIntersection={observePatternsIntersection}
              />
            ))}
          </InfiniteScroll>
        );
      case AttributeTab.Backdrop:
        return (
          <InfiniteScroll
            ref={backdropsContainerRef}
            className={buildClassName(styles.grid, 'custom-scroll')}
            beforeChildren={(
              <div className={styles.gridHeader}>
                <span className={styles.count}>
                  {lang('GiftPreviewCountBackdrops', { count: backdrops.length }, {
                    pluralValue: backdrops.length,
                    withNodes: true,
                    withMarkdown: true,
                  })}
                </span>
              </div>
            )}
            items={backdrops}
            noFastList
          >
            {backdrops.map((backdrop) => (
              <GiftAttributeItem
                key={backdrop.backdropId}
                className={styles.item}
                backdrop={backdrop}
                sticker={selectedModel?.sticker}
                stickerNoPlay
                patternSticker={selectedPattern?.sticker}
                rarity={backdrop.rarity}
                isSelected={selectedBackdrop?.backdropId === backdrop.backdropId}
                clickArg={backdrop}
                onClick={handleSelectBackdrop}
                observeIntersection={observeBackdropsIntersection}
              />
            ))}
          </InfiniteScroll>
        );
      default:
        return undefined;
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      className={buildClassName(styles.root, 'tall')}
      hasAbsoluteCloseButton
      absoluteCloseButtonColor="translucent-white"
      dialogClassName={styles.dialog}
      contentClassName={styles.content}
      header={modalHeader}
      isSlim
      onClose={handleClose}
    >
      {renderHeader()}
      <TabList
        className={styles.tabs}
        activeTab={selectedTabIndex}
        tabs={tabs}
        onSwitchTab={setSelectedTabIndex}
      />
      <Transition
        className={styles.transition}
        name={resolveTransitionName('slideOptimized', animationLevel, undefined, lang.isRtl)}
        activeKey={selectedTabIndex}
        renderCount={tabs.length}
      >
        {renderTabContent()}
      </Transition>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      animationLevel: selectAnimationLevel(global),
    };
  },
)(GiftPreviewModal));
