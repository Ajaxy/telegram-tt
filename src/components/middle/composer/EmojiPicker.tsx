import React, {
  FC, useState, useEffect, memo, useRef, useMemo, useCallback,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import { MENU_TRANSITION_DURATION } from '../../../config';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { IS_MOBILE_SCREEN } from '../../../util/environment';
import {
  EmojiModule,
  EmojiRawData,
  EmojiData,
  uncompressEmoji,
} from '../../../util/emoji';
import fastSmoothScroll from '../../../util/fastSmoothScroll';
import buildClassName from '../../../util/buildClassName';
import { pick } from '../../../util/iteratees';
import fastSmoothScrollHorizontal from '../../../util/fastSmoothScrollHorizontal';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import EmojiCategory from './EmojiCategory';

import './EmojiPicker.scss';

type OwnProps = {
  className?: string;
  onEmojiSelect: (emoji: string, name: string) => void;
};

type StateProps = Pick<GlobalState, 'recentEmojis'>;
type EmojiCategoryData = { id: string; name: string; emojis: string[] };

const ICONS_BY_CATEGORY: Record<string, string> = {
  recent: 'icon-recent',
  people: 'icon-smile',
  nature: 'icon-animals',
  foods: 'icon-eats',
  activity: 'icon-sport',
  places: 'icon-car',
  objects: 'icon-lamp',
  symbols: 'icon-language',
  flags: 'icon-flag',
};

const OPEN_ANIMATION_DELAY = 200;
// Only a few categories are above this height.
const SMOOTH_SCROLL_DISTANCE = 800;
const FOCUS_MARGIN = 50;
const HEADER_BUTTON_WIDTH = 42; // px. Includes margins
const INTERSECTION_THROTTLE = 200;

const categoryIntersections: boolean[] = [];

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

const EmojiPicker: FC<OwnProps & StateProps> = ({
  className, onEmojiSelect, recentEmojis,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);

  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const [emojis, setEmojis] = useState<AllEmojis>();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);

  const { observe: observeIntersection } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  }, (entries) => {
    entries.forEach((entry) => {
      const { id } = entry.target as HTMLDivElement;
      if (!id || !id.startsWith('emoji-category-')) {
        return;
      }

      const index = Number(id.replace('emoji-category-', ''));
      categoryIntersections[index] = entry.isIntersecting;
    });

    const intersectingWithIndexes = categoryIntersections
      .map((isIntersecting, index) => ({ index, isIntersecting }))
      .filter(({ isIntersecting }) => isIntersecting);

    if (!intersectingWithIndexes.length) {
      return;
    }

    setActiveCategoryIndex(intersectingWithIndexes[Math.floor(intersectingWithIndexes.length / 2)].index);
  });

  useHorizontalScroll(headerRef, !IS_MOBILE_SCREEN);

  // Scroll header when active set updates
  useEffect(() => {
    if (!categories) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeCategoryIndex * HEADER_BUTTON_WIDTH - header.offsetWidth / 2 + HEADER_BUTTON_WIDTH / 2;

    fastSmoothScrollHorizontal(header, newLeft);
  }, [categories, activeCategoryIndex]);

  const lang = useLang();

  const allCategories = useMemo(() => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }
    const themeCategories = [...categories];
    if (recentEmojis && recentEmojis.length) {
      themeCategories.unshift({
        id: 'recent',
        name: lang('RecentStickers'),
        emojis: recentEmojis,
      });
    }

    return themeCategories;
  }, [categories, lang, recentEmojis]);

  // Initialize data on first render.
  useEffect(() => {
    setTimeout(() => {
      const exec = () => {
        setCategories(emojiData.categories);

        setEmojis(emojiData.emojis as AllEmojis);
      };

      if (emojiData) {
        exec();
      } else {
        ensureEmojiData()
          .then(exec);
      }
    }, OPEN_ANIMATION_DELAY);
  }, []);

  const selectCategory = useCallback((index: number) => {
    setActiveCategoryIndex(index);
    const categoryEl = document.getElementById(`emoji-category-${index}`)!;
    fastSmoothScroll(containerRef.current!, categoryEl, 'start', FOCUS_MARGIN, SMOOTH_SCROLL_DISTANCE);
  }, []);

  const handleEmojiSelect = useCallback((emoji: string, name: string) => {
    onEmojiSelect(emoji, name);
  }, [onEmojiSelect]);

  const canRenderContents = useAsyncRendering([], MENU_TRANSITION_DURATION);

  function renderCategoryButton(category: EmojiCategoryData, index: number) {
    const icon = ICONS_BY_CATEGORY[category.id];

    return icon && (
      <Button
        className={`symbol-set-button ${index === activeCategoryIndex ? 'activated' : ''}`}
        round
        faded
        color="translucent"
        onClick={() => selectCategory(index)}
        ariaLabel={category.name}
      >
        <i className={icon} />
      </Button>
    );
  }

  const containerClassName = buildClassName('EmojiPicker', className);

  if (!emojis || !canRenderContents) {
    return (
      <div className={containerClassName}>
        <Loading />
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <div ref={headerRef} className="EmojiPicker-header" dir={lang.isRtl ? 'rtl' : ''}>
        {allCategories.map(renderCategoryButton)}
      </div>
      <div ref={containerRef} className="EmojiPicker-main no-selection no-scrollbar">
        {allCategories.map((category, i) => (
          <EmojiCategory
            category={category}
            index={i}
            allEmojis={emojis}
            observeIntersection={observeIntersection}
            shouldRender={activeCategoryIndex >= i - 1 && activeCategoryIndex <= i + 1}
            onEmojiSelect={handleEmojiSelect}
          />
        ))}
      </div>
    </div>
  );
};

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json') as unknown as Promise<EmojiModule>;
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => pick(global, ['recentEmojis']),
)(EmojiPicker));
