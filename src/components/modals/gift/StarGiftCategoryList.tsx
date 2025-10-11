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
  areCollectibleStarGiftsDisallowed?: boolean;
  isSelf?: boolean;
  hasCollectible?: boolean;
  onCategoryChanged: (category: StarGiftCategory) => void;
};

type StateProps = {
  idsByCategory?: Record<StarGiftCategory, string[]>;
};

const StarGiftCategoryList = ({
  idsByCategory,
  onCategoryChanged,
  areCollectibleStarGiftsDisallowed,
  isSelf,
  hasCollectible,
}: StateProps & OwnProps) => {
  const ref = useRef<HTMLDivElement>();

  const lang = useLang();

  const hasResale = idsByCategory && idsByCategory['resale'].length > 0;

  const [selectedCategory, setSelectedCategory] = useState<StarGiftCategory>('all');

  function handleItemClick(category: StarGiftCategory) {
    setSelectedCategory(category);
    onCategoryChanged(
      category,
    );
  }

  function renderCategoryName(category: StarGiftCategory) {
    if (category === 'all') return lang('AllGiftsCategory');
    if (category === 'myCollectibles') return lang('GiftCategoryMyGifts');
    if (category === 'resale') return lang('GiftCategoryCollectibles');
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
      {!areCollectibleStarGiftsDisallowed && !isSelf && hasCollectible && renderCategoryItem('myCollectibles')}
      {!areCollectibleStarGiftsDisallowed && hasResale && renderCategoryItem('resale')}
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const { starGifts } = global;

    return {
      idsByCategory: starGifts?.idsByCategory,
    };
  },
)(StarGiftCategoryList));
