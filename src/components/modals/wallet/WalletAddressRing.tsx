import { memo } from '../../../lib/teact/teact';

import { selectCanAnimateInterface } from '../../../global/selectors';
import { splitAddressIntoGroups } from '../../../util/tonAddress';

import useSelector from '../../../hooks/data/useSelector';
import useUniqueId from '../../../hooks/useUniqueId';

import styles from './WalletReceiveScreen.module.scss';

type OwnProps = {
  address: string;
  width: number;
  height: number;
};

const GAP = 12;
const RADIUS = 38;
const FONT_SIZE = 12;
// The monospace advance; `textLength` stretches the spacing over whatever is left
const CHAR_WIDTH = FONT_SIZE * 0.6;
const SPEED = 24;
const SEPARATOR = '   ·   ';

// The text runs along a path of two laps and moves back by one lap, so no glyph jumps at the seam
const WalletAddressRing = ({ address, width, height }: OwnProps) => {
  const pathId = useUniqueId();
  const canAnimate = useSelector(selectCanAnimateInterface);

  const ringWidth = width + GAP * 2;
  const ringHeight = height + GAP * 2;
  const perimeter = 2 * (ringWidth + ringHeight - 4 * RADIUS) + 2 * Math.PI * RADIUS;

  const label = `${splitAddressIntoGroups(address).join(' ')}${SEPARATOR}`;
  const text = label.repeat(Math.max(1, Math.round(perimeter / (label.length * CHAR_WIDTH))));

  const lap = buildLap(FONT_SIZE, FONT_SIZE, ringWidth, ringHeight);

  return (
    <svg
      className={styles.ring}
      width={ringWidth + FONT_SIZE * 2}
      height={ringHeight + FONT_SIZE * 2}
      aria-hidden
    >
      <path id={pathId} d={`M ${FONT_SIZE + RADIUS} ${FONT_SIZE} ${lap} ${lap}`} fill="none" />
      <text className={styles.ringText} textLength={perimeter} lengthAdjust="spacing">
        <textPath href={`#${pathId}`} startOffset={canAnimate ? undefined : 0}>
          {text}
          {canAnimate && (
            <animate
              attributeName="startOffset"
              from={perimeter}
              to={0}
              dur={`${perimeter / SPEED}s`}
              repeatCount="indefinite"
            />
          )}
        </textPath>
      </text>
    </svg>
  );
};

function buildLap(x: number, y: number, width: number, height: number) {
  const right = x + width;
  const bottom = y + height;
  const arc = `A ${RADIUS} ${RADIUS} 0 0 1`;

  return `H ${right - RADIUS} ${arc} ${right} ${y + RADIUS} V ${bottom - RADIUS} ${arc} ${right - RADIUS} ${bottom} `
    + `H ${x + RADIUS} ${arc} ${x} ${bottom - RADIUS} V ${y + RADIUS} ${arc} ${x + RADIUS} ${y}`;
}

export default memo(WalletAddressRing);
