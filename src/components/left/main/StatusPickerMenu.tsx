import type { ElementRef } from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import { SVG_NAMESPACE } from '../../../config';
import { selectIsContextMenuTranslucent } from '../../../global/selectors';
import {
  IS_SVG_CALC_SUPPORTED, IS_TUCK_SUPPORTED,
} from '../../../util/browser/windowEnvironment';
import { addSvgDefinition, removeSvgDefinition } from '../../../util/svgController';

import CustomEmojiPicker from '../../common/CustomEmojiPicker';
import Menu from '../../ui/Menu';
import Portal from '../../ui/Portal';

import styles from './StatusPickerMenu.module.scss';

import statusPickerTuck from '../../../assets/filters/status-picker-tuck.webp';

export type OwnProps = {
  isOpen: boolean;
  statusButtonRef: ElementRef<HTMLButtonElement>;
  onEmojiStatusSelect: (emojiStatus: ApiSticker) => void;
  onClose: () => void;
};

interface StateProps {
  areFeaturedStickersLoaded?: boolean;
  isTranslucent?: boolean;
}

const FILTER_ID = 'status-picker-tuck-filter';
const FILTER_BAND_START = IS_SVG_CALC_SUPPORTED ? 'calc(100% - 64px)' : '80%';
const FILTER_BAND_HEIGHT = IS_SVG_CALC_SUPPORTED ? '32' : '10%';

const StatusPickerMenu = ({
  isOpen,
  statusButtonRef,
  areFeaturedStickersLoaded,
  isTranslucent,
  onEmojiStatusSelect,
  onClose,
}: OwnProps & StateProps) => {
  const { loadFeaturedEmojiStickers } = getActions();

  const transformOriginXRef = useRef<number>(0);

  useEffect(() => {
    if (!statusButtonRef.current) return;
    transformOriginXRef.current = statusButtonRef.current.getBoundingClientRect().right;
  }, [isOpen, statusButtonRef]);

  useEffect(() => {
    if (isOpen && !areFeaturedStickersLoaded) {
      loadFeaturedEmojiStickers();
    }
  }, [areFeaturedStickersLoaded, isOpen, loadFeaturedEmojiStickers]);

  useEffect(() => {
    if (!IS_TUCK_SUPPORTED) return undefined;

    addSvgDefinition(
      <filter
        x="0"
        y="0"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
        primitiveUnits="userSpaceOnUse"
        color-interpolation-filters="sRGB"
        xmlns={SVG_NAMESPACE}
      >
        <feOffset
          in="SourceGraphic"
          dx="0"
          dy="0"
          width="100%"
          height={FILTER_BAND_START}
          result="untuckedSource"
        />
        <feImage
          href={statusPickerTuck}
          x="0"
          y={FILTER_BAND_START}
          width="100%"
          height={FILTER_BAND_HEIGHT}
          preserveAspectRatio="none"
          result="tuckMap"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="tuckMap"
          x="0"
          y={FILTER_BAND_START}
          width="100%"
          height={FILTER_BAND_HEIGHT}
          scale="48"
          xChannelSelector="R"
          yChannelSelector="B"
          result="tuckedSource"
        />
        <feMerge>
          <feMergeNode in="untuckedSource" />
          <feMergeNode in="tuckedSource" />
        </feMerge>
      </filter>,
      FILTER_ID,
    );

    return () => {
      removeSvgDefinition(FILTER_ID);
    };
  }, []);

  const handleEmojiSelect = useCallback((sticker: ApiSticker) => {
    onEmojiStatusSelect(sticker);
    onClose();
  }, [onClose, onEmojiStatusSelect]);

  return (
    <Portal>
      <Menu
        isOpen={isOpen}
        noCompact
        positionX="left"
        bubbleClassName={styles.menuContent}
        onClose={onClose}
        transformOriginX={transformOriginXRef.current}
      >
        <CustomEmojiPicker
          idPrefix="status-emoji-set-"
          className={IS_TUCK_SUPPORTED ? styles.extendedPicker : undefined}
          pickerListStyle={IS_TUCK_SUPPORTED ? `filter: url(#${FILTER_ID})` : undefined}
          loadAndPlay={isOpen}
          isHidden={!isOpen}
          isStatusPicker
          isTranslucent={isTranslucent}
          onDismiss={onClose}
          onCustomEmojiSelect={handleEmojiSelect}
        />
      </Menu>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  return {
    areFeaturedStickersLoaded: Boolean(global.customEmojis.featuredIds?.length),
    isTranslucent: selectIsContextMenuTranslucent(global),
  };
})(StatusPickerMenu));
