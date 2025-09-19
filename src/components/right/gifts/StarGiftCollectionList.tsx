import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarGiftCollection } from '../../../api/types';
import type { ProfileCollectionKey } from '../../../global/selectors/payments';
import type { AnimationLevel } from '../../../types';
import type { TabItem } from '../../common/AnimatedTabList';

import { selectActiveGiftsCollectionId } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedTabList from '../../common/AnimatedTabList';

import styles from './StarGiftCollectionList.module.scss';
type OwnProps = {
  peerId: string;
  className?: string;
};

type StateProps = {
  collections?: ApiStarGiftCollection[];
  activeCollectionId: ProfileCollectionKey;
  animationLevel: AnimationLevel;
};

const StarGiftCollectionList = ({
  peerId,
  className,
  collections,
  activeCollectionId,
  animationLevel,
}: StateProps & OwnProps) => {
  const { updateSelectedGiftCollection, resetSelectedGiftCollection } = getActions();
  const lang = useLang();

  const handleItemSelect = useLastCallback((itemId: string) => {
    if (itemId === 'all') {
      resetSelectedGiftCollection({ peerId });
    } else {
      const collectionId = Number(itemId);
      updateSelectedGiftCollection({ peerId, collectionId });
    }
  });

  if (!collections || collections.length === 0) {
    return undefined;
  }

  const items: TabItem[] = useMemo(() => [
    {
      id: 'all',
      title: lang('AllGiftsCategory'),
    },
    ...collections.map((collection) => ({
      id: String(collection.collectionId),
      title: collection.title,
      sticker: collection.icon,
    })),
  ], [collections, lang]);

  const selectedItemId = activeCollectionId ? String(activeCollectionId) : 'all';

  return (
    <AnimatedTabList
      items={items}
      selectedItemId={selectedItemId}
      animationLevel={animationLevel}
      onItemSelect={handleItemSelect}
      className={buildClassName(styles.tabList, className)}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { peerId }): Complete<StateProps> => {
    const { starGiftCollections } = global;
    const collections = starGiftCollections?.byPeerId?.[peerId];
    const activeCollectionId = selectActiveGiftsCollectionId(global, peerId);

    return {
      collections,
      activeCollectionId,
      animationLevel: selectSharedSettings(global).animationLevel,
    };
  },
)(StarGiftCollectionList));
