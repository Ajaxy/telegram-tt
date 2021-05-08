import React, { FC, memo } from '../../lib/teact/teact';

import { ApiMessage, ApiMessageOutgoingStatus } from '../../api/types';
import { formatPastTimeShort } from '../../util/dateFormat';
import MessageOutgoingStatus from './MessageOutgoingStatus';
import './LastMessageMeta.scss';

type OwnProps = {
  message: ApiMessage;
  outgoingStatus?: ApiMessageOutgoingStatus;
};

const LastMessageMeta: FC<OwnProps> = ({ message, outgoingStatus }) => {
  return (
    <div className="LastMessageMeta">
      {outgoingStatus && (
        <MessageOutgoingStatus status={outgoingStatus} />
      )}
      <span className="time">{formatPastTimeShort(message.date * 1000)}</span>
    </div>
  );
};

export default memo(LastMessageMeta);
