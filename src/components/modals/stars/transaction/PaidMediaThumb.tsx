import React, { memo } from '../../../../lib/teact/teact';

import type { ApiMediaExtendedPreview, BoughtPaidMedia } from '../../../../api/types';

import { getMediaHash, getMediaThumbUri } from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';

import useMedia from '../../../../hooks/useMedia';

import Icon from '../../../common/icons/Icon';
import MediaSpoiler from '../../../common/MediaSpoiler';

import styles from './PaidMediaThumb.module.scss';

type OwnProps = {
  className?: string;
  media: ApiMediaExtendedPreview[] | BoughtPaidMedia[];
  isTransactionPreview?: boolean;
  onClick?: NoneToVoidFunction;
};

const THUMB_LIMIT = 3;
const PREVIEW_THUMB_LIMIT = 2;

const PaidMediaThumb = ({
  media, className, isTransactionPreview, onClick,
}: OwnProps) => {
  const count = Math.min(media.length, isTransactionPreview ? PREVIEW_THUMB_LIMIT : THUMB_LIMIT);
  const isLocked = 'mediaType' in media[0];
  return (
    <div
      className={buildClassName(
        styles.root,
        styles[`itemCount${count}`],
        isTransactionPreview && styles.preview,
        className,
      )}
      dir="rtl"
      onClick={onClick}
    >
      {media.slice(0, count).reverse().map((item, i, arr) => {
        const realIndex = arr.length - i - 1;
        return 'mediaType' in item ? (
          <MediaSpoiler
            className={styles.thumb}
            isVisible
            width={item.width}
            height={item.height}
            thumbDataUri={item.thumbnail?.dataUri}
          />
        ) : (
          <SingleMediaThumb
            className={buildClassName(isTransactionPreview && realIndex > 0 && styles.noOutline)}
            boughtMedia={item}
            index={realIndex}
          />
        );
      })}
      {isLocked && (
        <div className={styles.count}>
          <Icon name="stars-lock" />
          {media.length > 1 ? media.length : ''}
        </div>
      )}
    </div>
  );
};

function SingleMediaThumb({
  boughtMedia,
  index,
  className,
}: {
  boughtMedia: BoughtPaidMedia;
  index?: number;
  className?: string;
}) {
  const media = (boughtMedia.video || boughtMedia.photo)!;
  const mediaHash = getMediaHash(media, 'pictogram');
  const thumb = getMediaThumbUri(media);

  const mediaBlob = useMedia(mediaHash);

  return (
    <div className={buildClassName(styles.thumb, index !== undefined && `stars-transaction-media-${index}`, className)}>
      {thumb && <img className={styles.blurry} src={thumb} alt="" />}
      {mediaBlob && <img className={styles.full} src={mediaBlob} alt="" />}
    </div>
  );
}

export default memo(PaidMediaThumb);
