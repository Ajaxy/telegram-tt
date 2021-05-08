import React, { FC, memo } from '../../../lib/teact/teact';

import { ApiMessage, ApiMessageOutgoingStatus } from '../../../api/types';

import { formatTime } from '../../../util/dateFormat';
import { formatIntegerCompact } from '../../../util/textFormat';

import MessageOutgoingStatus from '../../common/MessageOutgoingStatus';
import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';

import './MessageMeta.scss';

type OwnProps = {
  message: ApiMessage;
  outgoingStatus?: ApiMessageOutgoingStatus;
  signature?: string;
  onClick: () => void;
};

const MessageMeta: FC<OwnProps> = ({
  message, outgoingStatus, signature, onClick,
}) => {
  const lang = useLang();

  return (
    <span className="MessageMeta" onClick={onClick}>
      {Boolean(message.views) && (
        <>
          <span className="message-views">
            {formatIntegerCompact(message.views!)}
          </span>
          <i className="icon-channelviews" />
        </>
      )}
      {signature && (
        <span className="message-signature">{renderText(signature)}</span>
      )}
      <span className="message-time">
        {message.isEdited && `${lang('EditedMessage')} `}
        {formatTime(message.date * 1000)}
      </span>
      {outgoingStatus && (
        <MessageOutgoingStatus status={outgoingStatus} />
      )}
    </span>
  );
};

export default memo(MessageMeta);
