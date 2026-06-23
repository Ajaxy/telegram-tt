import { memo } from '../../lib/teact/teact';

import type { ApiDocument } from '../../api/types';

import { getDocumentMediaHash } from '../../global/helpers';
import buildStyle from '../../util/buildStyle';

import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';

import styles from './InlineImage.module.scss';

type OwnProps = {
  document: ApiDocument;
  width: number;
  height: number;
};

const InlineImage = ({
  document,
  width,
  height,
}: OwnProps) => {
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
        `width: ${width}px`,
        `height: ${height}px`,
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
