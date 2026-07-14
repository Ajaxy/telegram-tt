import { memo } from '../../lib/teact/teact';

import type { ApiDocument } from '../../api/types';

import { getDocumentMediaHash } from '../../global/helpers';
import buildStyle from '../../util/buildStyle';
import { REM } from '../common/helpers/mediaDimensions';

import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';

import styles from './InlineImage.module.scss';

type OwnProps = {
  document: ApiDocument;
  width: number;
  height: number;
};

const INLINE_IMAGE_HEIGHT_EM = 1.125;

const InlineImage = ({
  document,
  width,
  height,
}: OwnProps) => {
  const adaptedHeight = height / REM * INLINE_IMAGE_HEIGHT_EM;
  const adaptedWidth = (width / height) * adaptedHeight;
  const mediaHash = document.id
    ? getDocumentMediaHash(document, 'inline') || getDocumentMediaHash(document, 'full')
    : undefined;
  const mediaBlobUrl = useMedia(mediaHash);
  const { ref } = useMediaTransition<HTMLImageElement>({
    hasMediaData: Boolean(mediaBlobUrl),
  });

  return (
    <span
      className={styles.root}
      style={buildStyle(
        `width: ${adaptedWidth}em`,
        `height: ${adaptedHeight}em`,
      )}
    >
      <img
        ref={ref}
        className={styles.image}
        src={mediaBlobUrl}
        alt=""
        draggable={false}
        decoding="async"
      />
    </span>
  );
};

export default memo(InlineImage);
