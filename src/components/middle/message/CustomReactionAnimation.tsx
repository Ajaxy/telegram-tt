import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiReactionCustomEmoji } from '../../../api/types';

import { getStickerPreviewHash } from '../../../global/helpers';
import { IS_OFFSET_PATH_SUPPORTED } from '../../../util/environment';
import useMedia from '../../../hooks/useMedia';

import styles from './CustomReactionAnimation.module.scss';

type OwnProps = {
  reaction: ApiReactionCustomEmoji;
};

const EFFECT_AMOUNT = 7;

const CustomReactionAnimation: FC<OwnProps> = ({
  reaction,
}) => {
  const stickerHash = getStickerPreviewHash(reaction.documentId);

  const previewMediaData = useMedia(stickerHash);

  const paths: string[] = useMemo(() => {
    if (!IS_OFFSET_PATH_SUPPORTED) return [];
    return Array.from({ length: EFFECT_AMOUNT }).map(() => generateRandomDropPath());
  }, []);

  if (!previewMediaData) return undefined;

  return (
    <div className={styles.root}>
      {paths.map((path) => {
        const style = `--offset-path: path('${path}');`;
        return (
          <img
            src={previewMediaData}
            alt=""
            className={styles.particle}
            style={style}
          />
        );
      })}
    </div>
  );
};

export default memo(CustomReactionAnimation);

function generateRandomDropPath() {
  const x = (10 + Math.random() * 60) * (Math.random() > 0.5 ? 1 : -1);
  const y = 20 + Math.random() * 80;

  return `M 0 0 C 0 0 ${x} ${-y - 20} ${x} ${y}`;
}
