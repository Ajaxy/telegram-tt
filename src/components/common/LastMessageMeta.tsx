import { memo } from '../../lib/teact/teact';

import type { ApiMessage, ApiMessageOutgoingStatus } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { formatCompactTimestamp, secondsToDate } from '../../util/localization/dateFormat';

import useLang from '../../hooks/useLang';

import MessageOutgoingStatus from './MessageOutgoingStatus';

import './LastMessageMeta.scss';

type OwnProps = {
  className?: string;
  message: ApiMessage;
  outgoingStatus?: ApiMessageOutgoingStatus;
  draftDate?: number;
};

const LastMessageMeta = ({
  className, message, outgoingStatus, draftDate,
}: OwnProps) => {
  const lang = useLang();

  const shouldUseDraft = draftDate && draftDate > message.date;
  return (
    <div className={buildClassName('LastMessageMeta', className)}>
      {outgoingStatus && !shouldUseDraft && (
        <MessageOutgoingStatus status={outgoingStatus} />
      )}
      <span className="time">
        {formatCompactTimestamp(lang, secondsToDate(shouldUseDraft ? draftDate : message.date))}
      </span>
    </div>
  );
};

export default memo(LastMessageMeta);
