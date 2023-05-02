import type { FC, TeactNode } from '../../../lib/teact/teact';
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
  isTranslated?: boolean;
  isPinned?: boolean;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTranslationClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  renderQuickReactionButton?: () => TeactNode | undefined;
  onOpenThread: NoneToVoidFunction;
};

const MessageMeta: FC<OwnProps> = ({
  message,
  outgoingStatus,
  signature,
  withReactionOffset,
  repliesThreadInfo,
  renderQuickReactionButton,
  noReplies,
  isTranslated,
  isPinned,
  onClick,
  onTranslationClick,
  onOpenThread,
}) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const [isActivated, markActivated] = useFlag();

  function handleImportedClick(e: React.MouseEvent) {
    e.stopPropagation();

    showNotification({
      message: lang('ImportedInfo'),
    });
  }

  function handleOpenThread(e: React.MouseEvent) {
    e.stopPropagation();
    onOpenThread();
  }

  const title = useMemo(() => {
    if (!isActivated) return undefined;
    const createDateTime = formatDateTimeToString(message.date * 1000, lang.code, undefined, lang.timeFormat);
    const editDateTime = message.isEdited
      && formatDateTimeToString(message.editDate! * 1000, lang.code, undefined, lang.timeFormat);
    const forwardedDateTime = message.forwardInfo
      && formatDateTimeToString(message.forwardInfo.date * 1000, lang.code, undefined, lang.timeFormat);

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
    // We need to listen to timeformat change
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [isActivated, lang, message, lang.timeFormat]);

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
      {isTranslated && (
        <i className="icon icon-language message-translated" onClick={onTranslationClick} />
      )}
      {Boolean(message.views) && (
        <>
          <span className="message-views">
            {formatIntegerCompact(message.views!)}
          </span>
          <i className="icon icon-channelviews" />
        </>
      )}
      {!noReplies && Boolean(repliesThreadInfo?.messagesCount) && (
        <span onClick={handleOpenThread} className="message-replies-wrapper">
          <span className="message-replies">
            <AnimatedCounter text={formatIntegerCompact(repliesThreadInfo!.messagesCount!)} />
          </span>
          <i className="icon icon-reply-filled" />
        </span>
      )}
      {isPinned && (
        <i className="icon icon-pinned-message message-pinned" />
      )}
      {signature && (
        <span className="message-signature">{renderText(signature)}</span>
      )}
      <span className="message-time" title={title} onMouseEnter={markActivated}>
        {message.forwardInfo?.isImported && (
          <>
            <span className="message-imported" onClick={handleImportedClick}>
              {formatDateTimeToString(message.forwardInfo.date * 1000, lang.code, true)}
            </span>
            <span className="message-imported" onClick={handleImportedClick}>{lang('ImportedMessage')}</span>
          </>
        )}
        {message.isEdited && `${lang('EditedMessage')} `}
        {formatTime(lang, message.date * 1000)}
      </span>
      {outgoingStatus && (
        <MessageOutgoingStatus status={outgoingStatus} />
      )}
      {renderQuickReactionButton && renderQuickReactionButton()}
    </span>
  );
};

export default memo(MessageMeta);
