import React, { memo } from 'react';
import type { FC } from '../../../../../../lib/teact/teact';

const SvgFolderClosed: FC<{
  height: number;
  width: number;
  fill?: string;
}> = ({ height, width, fill = 'none' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
    >
      <rect x="1.5" y="6.5" width="15" height="9" rx="3" stroke={fill} strokeWidth="1.6" />
      <path d="M1.5 3.5C1.5 2.39543 2.39543 1.5 3.5 1.5H8.20776C8.78159 1.5 9.32777 1.74648 9.70743 2.17676L10.2779 2.82324C10.6575 3.25352 11.2037 3.5 11.7775 3.5H14.5C15.6046 3.5 16.5 4.39543 16.5 5.5V12.5C16.5 14.1569 15.1569 15.5 13.5 15.5H4.5C2.84315 15.5 1.5 14.1569 1.5 12.5L1.5 3.5Z" stroke={fill} strokeWidth="1.6" />
    </svg>
  );
};

export default memo(SvgFolderClosed);
