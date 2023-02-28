import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiAvailableReaction, ApiMessage, ApiMessageOutgoingStatus, ApiThreadInfo,
} from '../../../api/types';

import { formatDateTimeToString, formatTime } from '../../../util/dateFormat';
import { formatIntegerCompact } from '../../../util/textFormat';

import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import buildClassName from '../../../util/buildClassName';

import MessageOutgoingStatus from '../../common/MessageOutgoingStatus';
import AnimatedCounter from '../../common/AnimatedCounter';

import './MessageMeta.scss';

type OwnProps = {
  message: ApiMessage;
  withReactionOffset?: boolean;
  outgoingStatus?: ApiMessageOutgoingStatus;
  signature?: string;
  availableReactions?: ApiAvailableReaction[];
  noReplies?: boolean;
  repliesThreadInfo?: ApiThreadInfo;
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onOpenThread: () => void;
};

const MessageMeta: FC<OwnProps> = ({
  message,
  outgoingStatus,
  signature,
  withReactionOffset,
  repliesThreadInfo,
  noReplies,
  onClick,
  onOpenThread,
}) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const [isActivated, markActivated] = useFlag();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    showNotification({
      message: lang('ImportedInfo'),
    });
  };

  function handleOpenThread(e: React.MouseEvent) {
    e.stopPropagation();
    onOpenThread();
  }

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

  const fullClassName = buildClassName(
    'MessageMeta',
    withReactionOffset && 'reactions-offset',
    message.forwardInfo?.isImported && 'is-imported',
  );

  return (
    <span
      className={fullClassName}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      onClick={onClick}
      data-ignore-on-paste
    >
      {Boolean(message.views) && (
        <>
          <span className="message-views">
            {formatIntegerCompact(message.views!)}
          </span>
          <i className="icon-channelviews" />
        </>
      )}
      {!noReplies && Boolean(repliesThreadInfo?.messagesCount) && (
        <span onClick={handleOpenThread}>
          <span className="message-replies">
            <AnimatedCounter text={formatIntegerCompact(repliesThreadInfo!.messagesCount!)} />
          </span>
          <i className="icon-reply-filled" />
        </span>
      )}
      {signature && (
        <span className="message-signature">{renderText(signature)}</span>
      )}
      <span className="message-time" title={title} onMouseEnter={markActivated}>
        {message.forwardInfo?.isImported && (
          <>
            <span className="message-imported" onClick={handleClick}>
              {formatDateTimeToString(message.forwardInfo.date * 1000, lang.code, true)}
            </span>
            <span className="message-imported" onClick={handleClick}>{lang('ImportedMessage')}</span>
          </>
        )}
        {message.isEdited && `${lang('EditedMessage')} `}
        {formatTime(lang, message.date * 1000)}
      </span>
      {outgoingStatus && (
        <MessageOutgoingStatus status={outgoingStatus} />
      )}
    </span>
  );
};

export default memo(MessageMeta);
