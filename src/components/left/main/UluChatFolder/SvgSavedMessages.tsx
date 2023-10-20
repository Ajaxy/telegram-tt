import type { FC } from '../../../../lib/teact/teact';
import React from '../../../../lib/teact/teact';

type OwnProps = {
  height: string | number;
  width: string | number;
  fill?: string;
};

const SvgSavedMessages: FC<OwnProps> = ({ height, width, fill = 'none' }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="Component 10">
        <path id="Rectangle 40" d="M4 4C4 2.89543 4.89543 2 6 2H14C15.1046 2 16 2.89543 16 4V17.3747C16 18.2936 14.8648 18.7261 14.2534 18.04L11.4932 14.9425C10.6978 14.05 9.30221 14.05 8.50684 14.9425L5.74658 18.04C5.13523 18.7261 4 18.2936 4 17.3747L4 4Z" stroke={fill} stroke-width="1.6" />
      </g>
    </svg>
  );
};

export default SvgSavedMessages;
