import type { FC } from '../../../../lib/teact/teact';
import React from '../../../../lib/teact/teact';

type OwnProps = {
  height: string | number;
  width: string | number;
  fill?: string;
};

const SvgArchivedChat: FC<OwnProps> = ({ height, width, fill = 'none' }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="Component 10">
        <path id="Union" d="M6 2.8H14V1.2H6V2.8ZM17.2 6V14H18.8V6H17.2ZM14 17.2H6V18.8H14V17.2ZM2.8 14V6H1.2V14H2.8ZM6 17.2C4.23269 17.2 2.8 15.7673 2.8 14H1.2C1.2 16.651 3.34903 18.8 6 18.8V17.2ZM17.2 14C17.2 15.7673 15.7673 17.2 14 17.2V18.8C16.651 18.8 18.8 16.651 18.8 14H17.2ZM14 2.8C15.7673 2.8 17.2 4.23269 17.2 6H18.8C18.8 3.34903 16.651 1.2 14 1.2V2.8ZM6 1.2C3.34903 1.2 1.2 3.34903 1.2 6H2.8C2.8 4.23269 4.23269 2.8 6 2.8V1.2Z" fill={fill} />
        <path id="Vector 5018" d="M8 6H12" stroke={fill} stroke-width="1.6" stroke-linecap="round" />
      </g>
    </svg>
  );
};

export default SvgArchivedChat;
