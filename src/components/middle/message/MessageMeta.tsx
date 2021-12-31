import React, {
  FC, memo, useMemo,
} from '../../../lib/teact/teact';

import { ApiMessage, ApiMessageOutgoingStatus } from '../../../api/types';

import { formatDateTimeToString, formatTime } from '../../../util/dateFormat';
import { formatIntegerCompact } from '../../../util/textFormat';

import MessageOutgoingStatus from '../../common/MessageOutgoingStatus';
import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';

import './MessageMeta.scss';

type OwnProps = {
  message: ApiMessage;
  outgoingStatus?: ApiMessageOutgoingStatus;
  signature?: string;
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
};

const MessageMeta: FC<OwnProps> = ({
  message, outgoingStatus, signature, onClick,
}) => {
  const lang = useLang();
  const [isActivated, markActivated] = useFlag();

  const title = useMemo(() => {
    if (!isActivated) return undefined;
    const createDateTime = formatDateTimeToString(message.date * 1000, lang.code);
    const editDateTime = message.isEdited && formatDateTimeToString(message.editDate! * 1000, lang.code);
    const forwardedDateTime = message.forwardInfo && formatDateTimeToString(message.forwardInfo.date * 1000, lang.code);

    let text = createDateTime;
    if (editDateTime) {
      text += '\n';
      text += lang('lng_edited_date').replace('{date}', editDateTime);
    }
    if (forwardedDateTime) {
      text += '\n';
      text += lang('lng_forwarded_date').replace('{date}', forwardedDateTime);
    }

    return text;
  }, [isActivated, lang, message]);

  return (
    <span className="MessageMeta" dir={lang.isRtl ? 'rtl' : 'ltr'} onClick={onClick}>
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
      <span className="message-time" title={title} onMouseEnter={markActivated}>
        {message.isEdited && `${lang('EditedMessage')} `}
        {formatTime(message.date * 1000, lang)}
      </span>
      {outgoingStatus && (
        <MessageOutgoingStatus status={outgoingStatus} />
      )}
    </span>
  );
};

export default memo(MessageMeta);
