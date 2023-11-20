import React, { memo } from 'react';
import type { FC } from '../../../../../../../lib/teact/teact';

const SvgPin: FC<{
  className?: string;
  height: number;
  width: number;
  fill?: string;
}> = ({
  className, height, width, fill = 'none',
}) => {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={13}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
    >
      <path fill-rule="evenodd" clip-rule="evenodd" d="M7.26191 1.68149C7.57018 1.37322 8.06999 1.37322 8.37827 1.68149L11.1692 4.4724C11.4774 4.78067 11.4774 5.28048 11.1692 5.58876L10.8901 5.86782C10.736 6.02197 10.486 6.02191 10.3318 5.86776C10.1777 5.71367 9.92784 5.71361 9.77375 5.8677L9.49487 6.14658C9.4948 6.14665 9.4948 6.14675 9.49487 6.14682C9.49491 6.14686 9.49492 6.14691 9.49492 6.14696L9.21959 8.07425C9.10305 8.89001 8.10522 9.22262 7.52253 8.63993L4.21097 5.32837C3.62828 4.74568 3.96089 3.74785 4.77666 3.63131L6.50822 3.38395C6.63505 3.36583 6.75258 3.30706 6.84317 3.21647L6.98279 3.07685C7.13691 2.92273 7.13691 2.67285 6.98279 2.51873C6.82867 2.36461 6.82867 2.11473 6.98279 1.96061L7.26191 1.68149Z" fill={fill} />
      <path d="M4.75098 8.10034L3.07643 9.77488" stroke={fill} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
};

export default memo(SvgPin);
