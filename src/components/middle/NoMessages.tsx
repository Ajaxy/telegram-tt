import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ApiTopic } from '../../api/types';
import type { MessageListType } from '../../global/types';
import type { LangFn } from '../../hooks/useLang';

import { REM } from '../common/helpers/mediaDimensions';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';

import TopicIcon from '../common/TopicIcon';

import './NoMessages.scss';

const ICON_SIZE = 3 * REM;

type OwnProps = {
  chatId: string;
  isChatWithSelf?: boolean;
  type: MessageListType;
  isGroupChatJustCreated?: boolean;
  topic?: ApiTopic;
};

const NoMessages: FC<OwnProps> = ({
  isChatWithSelf,
  type,
  isGroupChatJustCreated,
  topic,
}) => {
  const lang = useLang();

  if (type === 'scheduled') {
    return renderScheduled(lang);
  }

  if (isChatWithSelf) {
    return renderSavedMessages(lang);
  }

  if (isGroupChatJustCreated) {
    return renderGroup(lang);
  }

  if (topic) {
    return renderTopic(lang, topic);
  }

  return (
    <div className="empty"><span>{lang('NoMessages')}</span></div>
  );
};

function renderTopic(lang: LangFn, topic: ApiTopic) {
  return (
    <div className="NoMessages">
      <div className="wrapper">
        <TopicIcon
          topic={topic}
          size={ICON_SIZE}
          className="no-messages-icon topic-icon"
        />
        <h3 className="title">{lang('Chat.EmptyTopicPlaceholder.Title')}</h3>
        <p className="description topic-description">{renderText(lang('Chat.EmptyTopicPlaceholder.Text'), ['br'])}</p>
      </div>
    </div>
  );
}

function renderScheduled(lang: LangFn) {
  return (
    <div className="empty"><span>{lang('ScheduledMessages.EmptyPlaceholder')}</span></div>
  );
}

function renderSavedMessages(lang: LangFn) {
  return (
    <div className="NoMessages">
      <div className="wrapper">
        <i className="icon no-messages-icon icon-cloud-download" />
        <h3 className="title">{lang('Conversation.CloudStorageInfo.Title')}</h3>
        <ul className="description">
          <li>{lang('Conversation.ClousStorageInfo.Description1')}</li>
          <li>{lang('Conversation.ClousStorageInfo.Description2')}</li>
          <li>{lang('Conversation.ClousStorageInfo.Description3')}</li>
          <li>{lang('Conversation.ClousStorageInfo.Description4')}</li>
        </ul>
      </div>
    </div>
  );
}

function renderGroup(lang: LangFn) {
  return (
    <div className="NoMessages">
      <div className="wrapper" dir={lang.isRtl ? 'rtl' : undefined}>
        <h3 className="title">{lang('EmptyGroupInfo.Title')}</h3>
        <p className="description">{lang('EmptyGroupInfo.Subtitle')}</p>
        <ul className="list-checkmarks">
          <li>{lang('EmptyGroupInfo.Line1')}</li>
          <li>{lang('EmptyGroupInfo.Line2')}</li>
          <li>{lang('EmptyGroupInfo.Line3')}</li>
          <li>{lang('EmptyGroupInfo.Line4')}</li>
        </ul>
      </div>
    </div>
  );
}

export default memo(NoMessages);
