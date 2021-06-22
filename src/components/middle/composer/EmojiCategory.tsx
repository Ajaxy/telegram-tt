import React, { FC, memo, useRef } from '../../../lib/teact/teact';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import windowSize from '../../../util/windowSize';
import { ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useShowTransition from '../../../hooks/useShowTransition';
import useLang from '../../../hooks/useLang';

import EmojiButton from './EmojiButton';

const EMOJIS_PER_ROW_ON_DESKTOP = 9;
const EMOJI_MARGIN = 4;
const MOBILE_CONTAINER_PADDING = 8;
const EMOJI_SIZE = 40;

type OwnProps = {
  category: EmojiCategory;
  index: number;
  allEmojis: AllEmojis;
  observeIntersection: ObserveFn;
  shouldRender: boolean;
  onEmojiSelect: (emoji: string, name: string) => void;
};

const EmojiCategory: FC<OwnProps> = ({
  category, index, allEmojis, observeIntersection, shouldRender, onEmojiSelect,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useOnIntersect(ref, observeIntersection);

  const { transitionClassNames } = useShowTransition(shouldRender, undefined, undefined, 'slow');

  const lang = useLang();

  const emojisPerRow = IS_SINGLE_COLUMN_LAYOUT
    ? Math.floor((windowSize.get().width - MOBILE_CONTAINER_PADDING) / (EMOJI_SIZE + EMOJI_MARGIN))
    : EMOJIS_PER_ROW_ON_DESKTOP;
  const height = Math.ceil(category.emojis.length / emojisPerRow) * (EMOJI_SIZE + EMOJI_MARGIN);

  return (
    <div
      ref={ref}
      key={category.id}
      id={`emoji-category-${index}`}
      className="symbol-set"
    >
      <p className="symbol-set-name" dir="auto">
        {lang(category.id === 'recent' ? 'RecentStickers' : `Emoji${index}`)}
      </p>
      <div
        className={buildClassName('symbol-set-container', transitionClassNames)}
        // @ts-ignore
        style={`height: ${height}px;`}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {shouldRender && category.emojis.map((name) => {
          const emoji = allEmojis[name];
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
