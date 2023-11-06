import React, { memo } from 'react';
import type { FC } from '../../../../../../lib/teact/teact';

const SvgFolderOpen: FC<{
  height: string | number;
  width: string | number;
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
      <path d="M4.41144 8.23652C4.75827 6.91858 5.94986 6 7.31267 6H16.1084C18.0754 6 19.5102 7.86122 19.0096 9.76348L18.0886 13.2635C17.7417 14.5814 16.5501 15.5 15.1873 15.5H5.09441C3.78306 15.5 2.82653 14.2592 3.16026 12.991L4.41144 8.23652Z" stroke={fill} strokeWidth="1.6" />
      <path d="M10.5 15.5H5.10189C3.60894 15.5 2.34317 14.4022 2.13204 12.9243L0.82612 3.78284C0.653996 2.57797 1.58892 1.5 2.80602 1.5H7.24879C7.7987 1.5 8.32435 1.72643 8.70213 2.12604L9.28316 2.74063C9.66094 3.14024 10.1866 3.36667 10.7365 3.36667H13.8027C14.7817 3.36667 15.6168 4.07539 15.7761 5.04139L15.8516 5.5" stroke={fill} strokeWidth="1.6" />
    </svg>
  );
};

export default memo(SvgFolderOpen);
