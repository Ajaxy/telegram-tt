import { memo, useRef } from '@teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom.ts';
import buildClassName from '../../../util/buildClassName.ts';

import useLastCallback from '../../../hooks/useLastCallback.ts';

import styles from './SwayingStar.module.scss';

interface OwnProps {
  color: 'purple' | 'gold';
  centerShift: readonly [number, number];
  onMouseMove: NoneToVoidFunction;
}

const INTERACTIVE_RADIUS = 50;

function SwayingStar({
  color,
  centerShift,
  onMouseMove,
}: OwnProps) {
  const starRef = useRef<HTMLDivElement>();

  const handleMouseMove = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 + centerShift[0];
    const centerY = rect.top + rect.height / 2 + centerShift[1];
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    const normalizedX = Math.max(-1, Math.min(1, mouseX / INTERACTIVE_RADIUS));
    const normalizedY = Math.max(-1, Math.min(1, mouseY / INTERACTIVE_RADIUS));
    const rotateY = normalizedX * 40;
    const rotateX = -normalizedY * 40;

    requestMutation(() => {
      starRef.current!.style.transform = `scale(1.1) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    onMouseMove();
  });

  const handleMouseLeave = useLastCallback(() => {
    requestMutation(() => {
      starRef.current!.style.transform = '';
    });
  });

  return (
    <div
      className={styles.root}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={starRef}
        className={buildClassName(styles.star, styles[`star_${color}`])}
        role="img"
        aria-label="Telegram Stars"
      />
    </div>
  );
}

export default memo(SwayingStar);
