import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiEmojiStatusType, ApiReactionCustomEmoji } from '../../../api/types';

import { getStickerHashById } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { IS_OFFSET_PATH_SUPPORTED } from '../../../util/windowEnvironment';

import useMedia from '../../../hooks/useMedia';

import CustomEmoji from '../CustomEmoji';

import styles from './CustomEmojiEffect.module.scss';

type OwnProps = {
  reaction: ApiReactionCustomEmoji | ApiEmojiStatusType;
  className?: string;
  isLottie?: boolean;
  particleSize?: number;
  onEnded?: NoneToVoidFunction;
};

const EFFECT_AMOUNT = 7;

const CustomEmojiEffect: FC<OwnProps> = ({
  reaction,
  isLottie,
  className,
  particleSize,
  onEnded,
}) => {
  const stickerHash = getStickerHashById(reaction.documentId, true);

  const previewMediaData = useMedia(!isLottie ? stickerHash : undefined);

  const paths: string[] = useMemo(() => {
    if (!IS_OFFSET_PATH_SUPPORTED) return [];
    return Array.from({ length: EFFECT_AMOUNT }).map(() => generateRandomDropPath(particleSize));
  }, [particleSize]);

  if (!previewMediaData && !isLottie) {
    return undefined;
  }

  return (
    <div
      className={buildClassName(styles.root, className)}
      style={buildStyle(Boolean(particleSize) && `--particle-size: ${particleSize}px`)}
    >
      {paths.map((path, i) => {
        const style = `--offset-path: path('${path}');`;
        if (isLottie) {
          return (
            <CustomEmoji
              documentId={reaction.documentId}
              className={styles.particle}
              style={style}
              withSharedAnimation
              size={particleSize}
              onAnimationEnd={i === 0 ? onEnded : undefined}
            />
          );
        }

        return (
          <img
            src={previewMediaData}
            alt=""
            className={styles.particle}
            style={style}
            draggable={false}
            onAnimationEnd={i === 0 ? onEnded : undefined}
          />
        );
      })}
    </div>
  );
};

export default memo(CustomEmojiEffect);

function generateRandomDropPath(particleSize = 20) {
  const x = (particleSize / 2 + Math.random() * particleSize * 3) * (Math.random() > 0.5 ? 1 : -1);
  const y = particleSize + Math.random() * particleSize * 4;

  return `M 0 0 C 0 0 ${x} ${-y - particleSize} ${x} ${y}`;
}
