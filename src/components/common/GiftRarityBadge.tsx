import type { ApiStarGiftAttributeRarity } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { getGiftRarityTitle } from './helpers/gifts';

import useLang from '../../hooks/useLang';

import BadgeButton from './BadgeButton';

import styles from './GiftRarityBadge.module.scss';

type OwnProps = {
  rarity: ApiStarGiftAttributeRarity;
  shouldInvertRare?: boolean;
  className?: string;
  onClick?: NoneToVoidFunction;
};

const GiftRarityBadge = ({ rarity, shouldInvertRare, className, onClick }: OwnProps) => {
  const lang = useLang();

  return (
    <BadgeButton
      className={buildClassName(
        styles.root,
        rarity.type !== 'regular' && styles[rarity.type],
        rarity.type !== 'regular' && styles.crafted,
        shouldInvertRare && rarity.type !== 'regular' && styles.inverted,
        className,
      )}
      onClick={onClick}
    >
      {getGiftRarityTitle(lang, rarity)}
    </BadgeButton>
  );
};

export default GiftRarityBadge;
