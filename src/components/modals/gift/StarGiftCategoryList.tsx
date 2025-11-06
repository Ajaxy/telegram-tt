import {
  memo, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { StarGiftCategory } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';

import styles from './StarGiftCategoryList.module.scss';

type OwnProps = {
  areUniqueStarGiftsDisallowed?: boolean;
  areLimitedStarGiftsDisallowed?: boolean;
  isSelf?: boolean;
  hasMyUnique?: boolean;
  onCategoryChanged: (category: StarGiftCategory) => void;
};

type StateProps = {
  idsByCategory?: Record<StarGiftCategory, string[]>;
};

const StarGiftCategoryList = ({
  idsByCategory,
  onCategoryChanged,
  areUniqueStarGiftsDisallowed,
  areLimitedStarGiftsDisallowed,
  isSelf,
  hasMyUnique,
}: StateProps & OwnProps) => {
  const ref = useRef<HTMLDivElement>();

  const lang = useLang();

  const hasCollectible = Boolean(idsByCategory?.collectible?.length);

  const [selectedCategory, setSelectedCategory] = useState<StarGiftCategory>('all');

  function handleItemClick(category: StarGiftCategory) {
    setSelectedCategory(category);
    onCategoryChanged(
      category,
    );
  }

  function renderCategoryName(category: StarGiftCategory) {
    if (category === 'all') return lang('AllGiftsCategory');
    if (category === 'myUnique') return lang('GiftCategoryMyGifts');
    if (category === 'collectible') return lang('GiftCategoryCollectibles');
    return category;
  }

  function renderCategoryItem(category: StarGiftCategory) {
    return (
      <div
        className={buildClassName(
          styles.item,
          selectedCategory === category && styles.selectedItem,
        )}
        onClick={() => handleItemClick(category)}
      >
        {renderCategoryName(category)}
      </div>
    );
  }

  useHorizontalScroll(ref, undefined, true);

  return (
    <div ref={ref} className={buildClassName(styles.list, 'no-scrollbar')}>
      {renderCategoryItem('all')}
      {!areUniqueStarGiftsDisallowed && !isSelf && hasMyUnique && renderCategoryItem('myUnique')}
      {(!areUniqueStarGiftsDisallowed || !areLimitedStarGiftsDisallowed)
        && hasCollectible && renderCategoryItem('collectible')}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { starGifts } = global;

    return {
      idsByCategory: starGifts?.idsByCategory,
    };
  },
)(StarGiftCategoryList));
