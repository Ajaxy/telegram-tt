import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import type { ApiSticker, ApiStickerSet } from '../../../api/types';

import { STICKER_SIZE_GENERAL_SETTINGS } from '../../../config';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';

import ListItem from '../../ui/ListItem';
import Button from '../../ui/Button';
import StickerSetCoverAnimated from '../../middle/composer/StickerSetCoverAnimated';
import StickerSetCover from '../../middle/composer/StickerSetCover';
import StickerButton from '../../common/StickerButton';

import './SettingsStickerSet.scss';

type OwnProps = {
  stickerSet?: ApiStickerSet;
  observeIntersection: ObserveFn;
  onClick: (value: ApiSticker) => void;
};

const SettingsStickerSet: FC<OwnProps> = ({
  stickerSet,
  observeIntersection,
  onClick,
}) => {
  const lang = useLang();

  if (!stickerSet || !stickerSet.stickers) {
    return undefined;
  }

  const firstSticker = stickerSet.stickers?.[0];

  if (stickerSet.hasThumbnail || !firstSticker) {
    return (
      <ListItem
        narrow
        className="SettingsStickerSet"
        inactive={!firstSticker}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => firstSticker && onClick(firstSticker)}
      >
        <Button
          ariaLabel={stickerSet.title}
          color="translucent"
          isRtl={lang.isRtl}
        >
          {stickerSet.isLottie ? (
            <StickerSetCoverAnimated
              size={STICKER_SIZE_GENERAL_SETTINGS}
              stickerSet={stickerSet}
              observeIntersection={observeIntersection}
            />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet}
              observeIntersection={observeIntersection}
            />
          )}
        </Button>
        <div className="multiline-menu-item">
          <div className="title">{stickerSet.title}</div>
          <div className="subtitle">{lang('StickerPack.StickerCount', stickerSet.count, 'i')}</div>
        </div>
      </ListItem>
    );
  } else {
    return (
      <ListItem
        narrow
        className="SettingsStickerSet"
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => onClick(firstSticker)}
      >
        <StickerButton
          sticker={firstSticker}
          size={STICKER_SIZE_GENERAL_SETTINGS}
          title={stickerSet.title}
          observeIntersection={observeIntersection}
          clickArg={undefined}
          noContextMenu
        />
        <div className="multiline-menu-item">
          <div className="title">{stickerSet.title}</div>
          <div className="subtitle">{lang('StickerPack.StickerCount', stickerSet.count, 'i')}</div>
        </div>
      </ListItem>
    );
  }
};

export default memo(SettingsStickerSet);
