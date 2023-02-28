import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ApiMessageOutgoingStatus } from '../../api/types';

import Transition from '../ui/Transition';

import './MessageOutgoingStatus.scss';

type OwnProps = {
  status: ApiMessageOutgoingStatus;
};

enum Keys {
  failed, pending, succeeded, read,
}

const MessageOutgoingStatus: FC<OwnProps> = ({ status }) => {
  return (
    <div className="MessageOutgoingStatus">
      <Transition name="reveal" activeKey={Keys[status]}>
        {status === 'failed' ? (
          <div className="MessageOutgoingStatus--failed">
            <i className="icon-message-failed" />
          </div>
        ) : <i className={`icon-message-${status}`} />}
      </Transition>
    </div>
  );
};

export default memo(MessageOutgoingStatus);
