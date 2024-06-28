import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ApiMessage, ApiMessageOutgoingStatus } from '../../api/types';

import { formatPastTimeShort } from '../../util/dates/dateFormat';

import useOldLang from '../../hooks/useOldLang';

import MessageOutgoingStatus from './MessageOutgoingStatus';

import './LastMessageMeta.scss';

type OwnProps = {
  message: ApiMessage;
  outgoingStatus?: ApiMessageOutgoingStatus;
  draftDate?: number;
};

const LastMessageMeta: FC<OwnProps> = ({ message, outgoingStatus, draftDate }) => {
  const lang = useOldLang();

  const shouldUseDraft = draftDate && draftDate > message.date;
  return (
    <div className="LastMessageMeta">
      {outgoingStatus && !shouldUseDraft && (
        <MessageOutgoingStatus status={outgoingStatus} />
      )}
      <span className="time">
        {formatPastTimeShort(lang, (shouldUseDraft ? draftDate : message.date) * 1000)}
      </span>
    </div>
  );
};

export default memo(LastMessageMeta);
