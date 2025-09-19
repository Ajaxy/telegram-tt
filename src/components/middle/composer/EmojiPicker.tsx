import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { GlobalState } from '../../../global/types';
import type { IconName } from '../../../types/icons';
import type { EmojiData, EmojiModule, EmojiRawData } from '../../../util/emoji/emoji';

import { MENU_TRANSITION_DURATION, RECENT_SYMBOL_SET_ID } from '../../../config';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import animateScroll from '../../../util/animateScroll';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { uncompressEmoji } from '../../../util/emoji/emoji';
import { pick } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { REM } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useScrolledState from '../../../hooks/useScrolledState';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition.tsx';
import EmojiCategory from './EmojiCategory';

import './EmojiPicker.scss';

type OwnProps = {
  className?: string;
  onEmojiSelect: (emoji: string, name: string) => void;
};

type StateProps = Pick<GlobalState, 'recentEmojis'>;

type EmojiCategoryData = { id: string; name: string; emojis: string[] };

const ICONS_BY_CATEGORY: Record<string, IconName> = {
  recent: 'recent',
  people: 'smile',
  nature: 'animals',
  foods: 'eats',
  activity: 'sport',
  places: 'car',
  objects: 'lamp',
  symbols: 'language',
  flags: 'flag',
};

const OPEN_ANIMATION_DELAY = 200;
const SMOOTH_SCROLL_DISTANCE = 100;
const FOCUS_MARGIN = 3.25 * REM;
const HEADER_BUTTON_WIDTH = 2.625 * REM; // Includes margins
const INTERSECTION_THROTTLE = 200;

const categoryIntersections: boolean[] = [];

let emojiDataPromise: Promise<EmojiModule> | undefined;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

const EmojiPicker: FC<OwnProps & StateProps> = ({
  className,
  recentEmojis,
  onEmojiSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>();
  const headerRef = useRef<HTMLDivElement>();

  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const [emojis, setEmojis] = useState<AllEmojis>();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const { isMobile } = useAppLayout();
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

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

    const minIntersectingIndex = categoryIntersections.reduce((lowestIndex, isIntersecting, index) => {
      return isIntersecting && index < lowestIndex ? index : lowestIndex;
    }, Infinity);

    if (minIntersectingIndex === Infinity) {
      return;
    }

    setActiveCategoryIndex(minIntersectingIndex);
  });

  const canRenderContents = useAsyncRendering([], MENU_TRANSITION_DURATION);
  const shouldRenderContent = emojis && canRenderContents;

  useHorizontalScroll(headerRef, !(isMobile && shouldRenderContent));

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

    animateHorizontalScroll(header, newLeft);
  }, [categories, activeCategoryIndex]);

  const lang = useOldLang();

  const allCategories = useMemo(() => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }
    const themeCategories = [...categories];
    if (recentEmojis?.length) {
      themeCategories.unshift({
        id: RECENT_SYMBOL_SET_ID,
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

  const selectCategory = useLastCallback((index: number) => {
    setActiveCategoryIndex(index);
    const categoryEl = containerRef.current!.closest<HTMLElement>('.SymbolMenu-main')!
      .querySelector<HTMLElement>(`#emoji-category-${index}`)!;
    animateScroll({
      container: containerRef.current!,
      element: categoryEl,
      position: 'start',
      margin: FOCUS_MARGIN,
      maxDistance: SMOOTH_SCROLL_DISTANCE,
    });
  });

  const handleEmojiSelect = useLastCallback((emoji: string, name: string) => {
    onEmojiSelect(emoji, name);
  });

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
        <Icon name={icon} />
      </Button>
    );
  }

  const containerClassName = buildClassName('EmojiPicker', className);
  const headerClassName = buildClassName(
    'EmojiPicker-header',
    !shouldHideTopBorder && 'with-top-border',
  );

  return (
    <Transition className={containerClassName} activeKey={shouldRenderContent ? 1 : 0} name="fade" shouldCleanup>
      {!shouldRenderContent ? (
        <Loading />
      ) : (
        <>
          <div
            ref={headerRef}
            className={headerClassName}
            dir={lang.isRtl ? 'rtl' : undefined}
          >
            {allCategories.map(renderCategoryButton)}
          </div>
          <div
            ref={containerRef}
            onScroll={handleContentScroll}
            className={buildClassName('EmojiPicker-main', IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
          >
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
        </>
      )}
    </Transition>
  );
};

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => pick(global, ['recentEmojis']),
)(EmojiPicker));
