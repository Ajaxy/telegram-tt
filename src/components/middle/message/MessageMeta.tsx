import React, {
  FC, memo, useMemo,
} from '../../../lib/teact/teact';

import { ApiAvailableReaction, ApiMessage, ApiMessageOutgoingStatus } from '../../../api/types';
import { ActiveReaction } from '../../../global/types';

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
}) => {
  const lang = useLang();
  const [isActivated, markActivated] = useFlag();

  const reactions = withReactions && message.reactions?.results.filter((l) => l.count > 0);

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
    <span
      className={buildClassName('MessageMeta', withReactionOffset && 'reactions-offset')}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      onClick={onClick}
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
