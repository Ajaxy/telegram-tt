import type { FC } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

import type { ApiSticker, ApiStickerSet } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { STICKER_SIZE_GENERAL_SETTINGS } from '../../config';
import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import StickerSetCover from '../middle/composer/StickerSetCover';
import Button from '../ui/Button';
import ListItem from '../ui/ListItem';
import StickerButton from './StickerButton';

import './StickerSetCard.scss';

type OwnProps = {
  stickerSet?: ApiStickerSet;
  noPlay?: boolean;
  className?: string;
  observeIntersection: ObserveFn;
  onClick: (value: ApiSticker) => void;
};

const StickerSetCard: FC<OwnProps> = ({
  stickerSet,
  noPlay,
  className,
  observeIntersection,
  onClick,
}) => {
  const lang = useOldLang();

  const firstSticker = stickerSet?.stickers?.[0];

  const handleCardClick = useLastCallback(() => {
    if (firstSticker) onClick(firstSticker);
  });

  if (!stickerSet?.stickers) {
    return undefined;
  }

  function renderPreview() {
    if (!stickerSet) return undefined;
    if (stickerSet.hasThumbnail || !firstSticker) {
      return (
        <Button
          ariaLabel={stickerSet.title}
          color="translucent"
          isRtl={lang.isRtl}
        >
          <StickerSetCover
            stickerSet={stickerSet}
            size={STICKER_SIZE_GENERAL_SETTINGS}
            noPlay={noPlay}
            observeIntersection={observeIntersection}
          />
        </Button>
      );
    } else {
      return (
        <StickerButton
          sticker={firstSticker}
          size={STICKER_SIZE_GENERAL_SETTINGS}
          title={stickerSet.title}
          noPlay={noPlay}
          observeIntersection={observeIntersection}
          noContextMenu
          isCurrentUserPremium
          clickArg={undefined}
        />
      );
    }
  }

  return (
    <ListItem
      className={buildClassName('StickerSetCard', 'small-icon', className)}
      inactive={!firstSticker}
      onClick={handleCardClick}
    >
      {renderPreview()}
      <div className="multiline-item">
        <div className="title">{stickerSet.title}</div>
        <div className="subtitle">{lang('StickerPack.StickerCount', stickerSet.count, 'i')}</div>
      </div>
    </ListItem>
  );
};

export default memo(StickerSetCard);
