import { memo, useState } from '@teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom.ts';
import { animateSingle } from '../../../util/animation.ts';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets.ts';

import useLastCallback from '../../../hooks/useLastCallback.ts';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview.tsx';

import styles from './SpeedingDiamond.module.scss';

import diamondPreviewUrl from '../../../assets/diamond.png';

interface OwnProps {
  onMouseMove: NoneToVoidFunction;
}

const MAX_SPEED = 5;
const MIN_SPEED = 1;
const SLOWDOWN_DELAY = 300;
const SLOWDOWN_DURATION = 1500;

let slowdownTimeout: number | undefined;
let isAnimating = true;

function SpeedingDiamond({ onMouseMove }: OwnProps) {
  const [speed, setSpeed] = useState(MIN_SPEED);

  const handleMouseMove = useLastCallback(() => {
    if (slowdownTimeout) {
      clearTimeout(slowdownTimeout);
      slowdownTimeout = undefined;
    }

    slowdownTimeout = window.setTimeout(() => {
      const startAt = Date.now();

      isAnimating = true;

      animateSingle(() => {
        if (!isAnimating) return false;

        const t = Math.min((Date.now() - startAt) / SLOWDOWN_DURATION, 1);
        const newSpeed = (MAX_SPEED - MIN_SPEED) * (1 - transition(t));

        setSpeed(newSpeed);

        isAnimating = t < 1 && newSpeed > 1;

        return isAnimating;
      }, requestMutation);
    }, SLOWDOWN_DELAY);

    isAnimating = false;
    setSpeed(MAX_SPEED);
    onMouseMove();
  });

  return (
    <div className={styles.root}>
      <div
        className={styles.diamond}
        onMouseMove={handleMouseMove}
      >
        <AnimatedIconWithPreview
          speed={speed}
          size={130}
          tgsUrl={LOCAL_TGS_URLS.Diamond}
          previewUrl={diamondPreviewUrl}
          nonInteractive
          noLoop={false}
        />
      </div>
    </div>
  );
}

export default memo(SpeedingDiamond);

function transition(t: number) {
  return 1 - ((1 - t) ** 2);
}
