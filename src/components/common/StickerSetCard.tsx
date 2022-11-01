import React, { memo, useCallback } from '../../lib/teact/teact';

import type { ApiSticker, ApiStickerSet } from '../../api/types';
import type { FC } from '../../lib/teact/teact';

import { STICKER_SIZE_GENERAL_SETTINGS } from '../../config';
import buildClassName from '../../util/buildClassName';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';

import ListItem from '../ui/ListItem';
import Button from '../ui/Button';
import StickerSetCover from '../middle/composer/StickerSetCover';
import StickerButton from './StickerButton';

import './StickerSetCard.scss';

type OwnProps = {
  stickerSet?: ApiStickerSet;
  noAnimate?: boolean;
  className?: string;
  observeIntersection: ObserveFn;
  onClick: (value: ApiSticker) => void;
};

const StickerSetCard: FC<OwnProps> = ({
  stickerSet,
  noAnimate,
  className,
  observeIntersection,
  onClick,
}) => {
  const lang = useLang();

  const firstSticker = stickerSet?.stickers?.[0];

  const handleCardClick = useCallback(() => {
    if (firstSticker) onClick(firstSticker);
  }, [firstSticker, onClick]);

  if (!stickerSet || !stickerSet.stickers) {
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
            noAnimate={noAnimate}
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
          noAnimate={noAnimate}
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
      narrow
      className={buildClassName('StickerSetCard', className)}
      inactive={!firstSticker}
      onClick={handleCardClick}
    >
      {renderPreview()}
      <div className="multiline-menu-item">
        <div className="title">{stickerSet.title}</div>
        <div className="subtitle">{lang('StickerPack.StickerCount', stickerSet.count, 'i')}</div>
      </div>
    </ListItem>
  );
};

export default memo(StickerSetCard);
