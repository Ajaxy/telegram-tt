import type { FC } from '../../../lib/teact/teact';
import { memo, useRef } from '../../../lib/teact/teact';

import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { EMOJI_SIZE_PICKER } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import windowSize from '../../../util/windowSize';
import { REM } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaTransitionDeprecated from '../../../hooks/useMediaTransitionDeprecated';
import useOldLang from '../../../hooks/useOldLang';

import EmojiButton from './EmojiButton';

const EMOJIS_PER_ROW_ON_DESKTOP = 8;
const EMOJI_MARGIN = 0.625 * REM;
const EMOJI_VERTICAL_MARGIN = 0.25 * REM;
const EMOJI_VERTICAL_MARGIN_MOBILE = 0.5 * REM;
const MOBILE_CONTAINER_PADDING = 0.5 * REM;

type OwnProps = {
  category: EmojiCategory;
  sectionId: string;
  title: string;
  allEmojis: AllEmojis;
  observeIntersection: ObserveFn;
  shouldRender: boolean;
  onEmojiSelect: (emoji: string, name: string) => void;
};

const EmojiCategory: FC<OwnProps> = ({
  category, sectionId, title, allEmojis, observeIntersection, shouldRender, onEmojiSelect,
}) => {
  const ref = useRef<HTMLDivElement>();

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const shouldRenderContent = shouldRender || isIntersecting;

  const transitionClassNames = useMediaTransitionDeprecated(shouldRenderContent);

  const lang = useOldLang();
  const { isMobile } = useAppLayout();

  const emojisPerRow = isMobile
    ? Math.floor(
      (windowSize.get().width - MOBILE_CONTAINER_PADDING + EMOJI_MARGIN) / (EMOJI_SIZE_PICKER + EMOJI_MARGIN),
    )
    : EMOJIS_PER_ROW_ON_DESKTOP;
  const height = Math.ceil(category.emojis.length / emojisPerRow)
    * (EMOJI_SIZE_PICKER + (isMobile ? EMOJI_VERTICAL_MARGIN_MOBILE : EMOJI_VERTICAL_MARGIN));

  return (
    <div
      ref={ref}
      key={category.id}
      id={sectionId}
      className="symbol-set"
    >
      <div className="symbol-set-header">
        <p className="symbol-set-name" dir="auto">
          {title}
        </p>
      </div>
      <div
        className={buildClassName('symbol-set-container', transitionClassNames)}
        style={`height: ${height}px;`}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {shouldRenderContent && category.emojis.map((name) => {
          const emoji = allEmojis[name];
          // Recent emojis may contain emoticons that are no longer in the list
          if (!emoji) {
            return undefined;
          }
          // Some emojis have multiple skins and are represented as an Object with emojis for all skins.
          // For now, we select only the first emoji with 'neutral' skin.
          const displayedEmoji = 'id' in emoji ? emoji : emoji[1];

          return (
            <EmojiButton
              key={displayedEmoji.id}
              emoji={displayedEmoji}
              onClick={onEmojiSelect}
            />
          );
        })}
      </div>
    </div>
  );
};

export default memo(EmojiCategory);
