import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import buildClassName from '../../../util/buildClassName';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';

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
    <div className={buildClassName(
      'ChatCallStatus',
      isActive && 'active',
      isSelected && !IS_SINGLE_COLUMN_LAYOUT && 'selected',
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
