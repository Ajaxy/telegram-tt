import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import buildClassName from '../../../util/buildClassName';

import './ChatCallStatus.scss';

type OwnProps = {
  isSelected?: boolean;
  isActive?: boolean;
  isMobile?: boolean;
};

const ChatCallStatus: FC<OwnProps> = ({
  isSelected,
  isActive,
  isMobile,
}) => {
  return (
    <div className={buildClassName(
      'ChatCallStatus',
      isActive && 'active',
      isSelected && !isMobile && 'selected',
    )}
    >
      <div className="indicator">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
};

export default memo(ChatCallStatus);
