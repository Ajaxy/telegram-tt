import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiAvailableReaction, ApiMessage, ApiMessageOutgoingStatus } from '../../../api/types';
import type { ActiveReaction } from '../../../global/types';

import { formatDateTimeToString, formatTime } from '../../../util/dateFormat';
import { formatIntegerCompact } from '../../../util/textFormat';

import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import buildClassName from '../../../util/buildClassName';

import MessageOutgoingStatus from '../../common/MessageOutgoingStatus';
import ReactionAnimatedEmoji from './ReactionAnimatedEmoji';

import './MessageMeta.scss';

type OwnProps = {
  message: ApiMessage;
  reactionMessage?: ApiMessage;
  withReactions?: boolean;
  withReactionOffset?: boolean;
  outgoingStatus?: ApiMessageOutgoingStatus;
  signature?: string;
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  activeReaction?: ActiveReaction;
  availableReactions?: ApiAvailableReaction[];
};

const MessageMeta: FC<OwnProps> = ({
  message, outgoingStatus, signature, onClick, withReactions,
  activeReaction, withReactionOffset, availableReactions,
  reactionMessage,
}) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const [isActivated, markActivated] = useFlag();

  const reactions = withReactions && reactionMessage?.reactions?.results.filter((l) => l.count > 0);
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    showNotification({
      message: lang('ImportedInfo'),
    });
  };

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
      {reactions && reactions.map((l) => (
        <ReactionAnimatedEmoji
          activeReaction={activeReaction}
          reaction={l.reaction}
          isInMeta
          availableReactions={availableReactions}
        />
      ))}
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
