import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStoryAlbum } from '../../../api/types';
import type { ProfileCollectionKey } from '../../../global/selectors/payments';
import type { AnimationLevel } from '../../../types';
import type { TabItem } from '../../common/AnimatedTabList';

import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { selectActiveStoriesCollectionId } from '../../../global/selectors/stories';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedTabList from '../../common/AnimatedTabList';

import styles from './StoryAlbumList.module.scss';

type OwnProps = {
  peerId: string;
  className?: string;
};

type StateProps = {
  albums?: ApiStoryAlbum[];
  selectedAlbumId: ProfileCollectionKey;
  animationLevel: AnimationLevel;
};

const StoryAlbumList = ({
  peerId,
  className,
  albums,
  selectedAlbumId,
  animationLevel,
}: StateProps & OwnProps) => {
  const { selectStoryAlbum, resetSelectedStoryAlbum } = getActions();
  const lang = useLang();

  const handleItemSelect = useLastCallback((itemId: string) => {
    if (itemId === 'all') {
      resetSelectedStoryAlbum();
    } else {
      const albumId = Number(itemId);
      selectStoryAlbum({ peerId, albumId });
    }
  });

  if (!albums?.length) {
    return undefined;
  }

  const items: TabItem[] = useMemo(() => [
    {
      id: 'all',
      title: lang('AllStoriesCategory'),
    },
    ...albums.map((album) => ({
      id: String(album.albumId),
      title: album.title,
    })),
  ], [albums, lang]);

  const selectedItemId = selectedAlbumId ? String(selectedAlbumId) : 'all';

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
    const { stories } = global;
    const albums = stories?.albumsByPeerId?.[peerId];
    const selectedAlbumId = selectActiveStoriesCollectionId(global);

    return {
      albums,
      selectedAlbumId,
      animationLevel: selectSharedSettings(global).animationLevel,
    };
  },
)(StoryAlbumList));
