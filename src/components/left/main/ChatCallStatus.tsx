import React, { FC, memo } from '../../../lib/teact/teact';
import buildClassName from '../../../util/buildClassName';

import './ChatCallStatus.scss';

type OwnProps = {
  isSelected?: boolean;
  isActive?: boolean;
};

const ChatCallStatus: FC<OwnProps> = ({
  isSelected,
  isActive,
}) => {
  return (
    <div className={buildClassName('ChatCallStatus', isActive && 'active', isSelected && 'selected')}>
      <div className="indicator">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
};

export default memo(ChatCallStatus);
