import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ApiMessageOutgoingStatus } from '../../api/types';

import Transition from '../ui/Transition';
import Icon from './icons/Icon';

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
            <Icon name="message-failed" />
          </div>
        ) : <Icon name={`message-${status}`} />}
      </Transition>
    </div>
  );
};

export default memo(MessageOutgoingStatus);
