import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiEmojiStatus, ApiReactionCustomEmoji } from '../../../api/types';

import { IS_OFFSET_PATH_SUPPORTED } from '../../../util/environment';
import { getStickerPreviewHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import useMedia from '../../../hooks/useMedia';

import CustomEmoji from '../../common/CustomEmoji';

import styles from './CustomEmojiEffect.module.scss';

type OwnProps = {
  reaction: ApiReactionCustomEmoji | ApiEmojiStatus;
  className?: string;
  isLottie?: boolean;
};

const EFFECT_AMOUNT = 7;

const CustomEmojiEffect: FC<OwnProps> = ({
  reaction,
  isLottie,
  className,
}) => {
  const stickerHash = getStickerPreviewHash(reaction.documentId);

  const previewMediaData = useMedia(!isLottie ? stickerHash : undefined);

  const paths: string[] = useMemo(() => {
    if (!IS_OFFSET_PATH_SUPPORTED) return [];
    return Array.from({ length: EFFECT_AMOUNT }).map(() => generateRandomDropPath());
  }, []);

  if (!previewMediaData && !isLottie) {
    return undefined;
  }

  return (
    <div className={buildClassName(styles.root, className)}>
      {paths.map((path) => {
        const style = `--offset-path: path('${path}');`;
        if (isLottie) {
          return (
            <CustomEmoji
              documentId={reaction.documentId}
              className={styles.particle}
              style={style}
              withSharedAnimation
            />
          );
        }

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

export default memo(CustomEmojiEffect);

function generateRandomDropPath() {
  const x = (10 + Math.random() * 60) * (Math.random() > 0.5 ? 1 : -1);
  const y = 20 + Math.random() * 80;

  return `M 0 0 C 0 0 ${x} ${-y - 20} ${x} ${y}`;
}
