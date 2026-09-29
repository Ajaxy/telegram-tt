import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessage,
  ApiPeer,
  ApiTopic,
} from '../../../api/types';
import type { ThreadId } from '../../../types';

import {
  getMessageIsSpoiler,
  getMessageRoundVideo,
  getMessageSticker,
  getMessageVideo,
} from '../../../global/helpers';
import { getMessageSenderName, isApiPeerUser } from '../../../global/helpers/peers';
import {
  selectChat,
  selectPeer,
  selectSender,
  selectTopic,
} from '../../../global/selectors';
import { selectThreadIdFromMessage } from '../../../global/selectors/threads';
import buildClassName from '../../../util/buildClassName';
import { formatPastTimeShort } from '../../../util/dates/oldDateFormat';
import { type LangFn } from '../../../util/localization';
import { REM } from '../../common/helpers/mediaDimensions';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';
import renderText from '../../common/helpers/renderText';

import useMessageMediaHash from '../../../hooks/media/useMessageMediaHash';
import useThumbnail from '../../../hooks/media/useThumbnail';
import useAppLayout from '../../../hooks/useAppLayout';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useSelectWithEnter from '../../../hooks/useSelectWithEnter';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Icon from '../../common/icons/Icon';
import TopicIcon from '../../common/TopicIcon';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';

import './ChatMessage.scss';

type OwnProps = {
  searchQuery?: string;
  message: ApiMessage;
  chatId: string;
  withTopic?: boolean;
};

type StateProps = {
  peer?: ApiPeer;
  sender?: ApiPeer;
  topic?: ApiTopic;
  threadId?: ThreadId;
};

const TOPIC_ICON_SIZE = 2.5 * REM;

const ChatMessage = ({
  message,
  searchQuery,
  chatId,
  peer,
  sender,
  topic,
  threadId,
}: OwnProps & StateProps) => {
  const { focusMessage } = getActions();

  const { isMobile } = useAppLayout();
  const thumbDataUri = useThumbnail(message);
  const mediaThumbnail = !getMessageSticker(message) ? thumbDataUri : undefined;
  const mediaHash = useMessageMediaHash(message, 'micro');
  const mediaBlobUrl = useMedia(mediaHash);
  const isRoundVideo = Boolean(getMessageRoundVideo(message));

  const handleClick = useLastCallback(() => {
    focusMessage({
      chatId, messageId: message.id, threadId, shouldReplaceHistory: true,
    });
  });

  const lang = useLang();
  const oldLang = useOldLang();

  const buttonRef = useSelectWithEnter(handleClick);

  if (!peer) {
    return undefined;
  }

  const user = isApiPeerUser(peer) ? peer : undefined;
  const senderName = topic && sender ? getMessageSenderName(lang, chatId, sender) : undefined;

  return (
    <ListItem
      className="ChatMessage chat-item-clickable"
      ripple={!isMobile}
      onClick={handleClick}
      buttonRef={buttonRef}
    >
      {topic ? (
        <div className="topic-icon-wrapper">
          <TopicIcon
            size={TOPIC_ICON_SIZE}
            topic={topic}
            className="topic-icon"
          />
        </div>
      ) : (
        <Avatar
          peer={peer}
          isSavedMessages={user?.isSelf}
        />
      )}
      <div className="info">
        <div className="info-row">
          {topic ? (
            <div className="title topic-title">
              <h3 dir="auto" className="fullName">{renderText(topic.title)}</h3>
            </div>
          ) : (
            <FullNameTitle
              peer={peer}
              withEmojiStatus
              isSavedMessages={user?.isSelf}
            />
          )}
          <div className="message-date">
            <Link className="date">
              {formatPastTimeShort(oldLang, message.date * 1000)}
            </Link>
          </div>

        </div>
        <div className="subtitle">
          <div className="message" dir="auto">
            {senderName && <span className="sender-name">{renderText(senderName)}</span>}
            {renderSummary(lang, message, mediaBlobUrl || mediaThumbnail, searchQuery, isRoundVideo)}
          </div>
        </div>
      </div>
    </ListItem>
  );
};

function renderSummary(
  lang: LangFn, message: ApiMessage, blobUrl?: string, searchQuery?: string, isRoundVideo?: boolean,
) {
  if (!blobUrl) {
    return renderMessageSummary(lang, message, undefined, searchQuery);
  }

  const isSpoiler = getMessageIsSpoiler(message);

  return (
    <span className="media-preview">
      <img
        src={blobUrl}
        alt=""
        className={
          buildClassName('media-preview--image', isRoundVideo && 'round', isSpoiler && 'media-preview-spoiler')
        }
        draggable={false}
      />
      {getMessageVideo(message) && <Icon name="play" />}
      {renderMessageSummary(lang, message, true, searchQuery)}
    </span>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId, message, withTopic }): Complete<StateProps> => {
    const peer = selectPeer(global, chatId);
    const chat = selectChat(global, chatId);

    const isForumTopicMode = Boolean(withTopic && chat?.isForum && !chat.isBotForum);
    const threadId = isForumTopicMode ? selectThreadIdFromMessage(global, message) : undefined;
    const topic = threadId !== undefined ? selectTopic(global, chatId, threadId) : undefined;
    const sender = topic ? selectSender(global, message) : undefined;

    return {
      peer,
      sender,
      topic,
      threadId,
    };
  },
)(ChatMessage));
