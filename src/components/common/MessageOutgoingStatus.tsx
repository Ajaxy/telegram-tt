import React, { FC } from '../../lib/teact/teact';

import { ApiMessageOutgoingStatus } from '../../api/types';

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
        {() => (
          <i className={`icon-message-${status}`} />
        )}
      </Transition>
    </div>
  );
};

export default MessageOutgoingStatus;
