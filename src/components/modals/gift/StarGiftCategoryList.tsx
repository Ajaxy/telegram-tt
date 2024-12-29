import React, {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { StarGiftCategory } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';

import StarIcon from '../../common/icons/StarIcon';

import styles from './StarGiftCategoryList.module.scss';

type OwnProps = {
  onCategoryChanged: (category: StarGiftCategory) => void;
};

type StateProps = {
  starGiftCategoriesByName: Record<StarGiftCategory, string[]>;
};

const StarGiftCategoryList = ({
  starGiftCategoriesByName,
  onCategoryChanged,
}: StateProps & OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const lang = useLang();
  const starCategories: number[] = useMemo(() => Object.keys(starGiftCategoriesByName)
    .filter((category) => category !== 'all' && category !== 'limited')
    .map(Number)
    .sort((a, b) => a - b),
  [starGiftCategoriesByName]);

  const [selectedCategory, setSelectedCategory] = useState<StarGiftCategory>('all');

  function handleItemClick(category: StarGiftCategory) {
    setSelectedCategory(category);
    onCategoryChanged(
      category,
    );
  }

  function renderCategoryName(category: StarGiftCategory) {
    if (category === 'all') {
      return lang('AllGiftsCategory');
    }
    if (category === 'limited') {
      return lang('LimitedGiftsCategory');
    }
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
        {category !== 'all' && category !== 'limited' && (
          <StarIcon
            className={styles.star}
            type="gold"
            size="middle"
          />
        )}
        {renderCategoryName(category)}
      </div>
    );
  }

  useHorizontalScroll(ref, undefined, true);

  return (
    <div ref={ref} className={buildClassName(styles.list, 'no-scrollbar')}>
      {renderCategoryItem('all')}
      {renderCategoryItem('limited')}
      {starCategories.map(renderCategoryItem)}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const { starGiftCategoriesByName } = global;

    return {
      starGiftCategoriesByName,
    };
  },
)(StarGiftCategoryList));
