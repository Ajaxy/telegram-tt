import { memo } from '../../lib/teact/teact';

import type { ApiTopic } from '../../api/types';
import type { MessageListType } from '../../types';
import type { LangFn } from '../../util/localization';

import { REM } from '../common/helpers/mediaDimensions';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import TopicIcon from '../common/TopicIcon';

import './NoMessages.scss';

const ICON_SIZE = 3 * REM;
const GROUP_MEMBERS_LIMIT = 200000;

type OwnProps = {
  chatId: string;
  isChatWithSelf?: boolean;
  type: MessageListType;
  isGroupChatJustCreated?: boolean;
  topic?: ApiTopic;
};

const NoMessages = ({
  isChatWithSelf,
  type,
  isGroupChatJustCreated,
  topic,
}: OwnProps) => {
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
        <h3 className="title">{lang('ChatEmptyTopicPlaceholderTitle')}</h3>
        <p className="description topic-description">{renderText(lang('ChatEmptyTopicPlaceholderText'), ['br'])}</p>
      </div>
    </div>
  );
}

function renderScheduled(lang: LangFn) {
  return (
    <div className="empty"><span>{lang('ScheduledMessagesEmptyPlaceholder')}</span></div>
  );
}

function renderSavedMessages(lang: LangFn) {
  return (
    <div className="NoMessages">
      <div className="wrapper">
        <Icon name="cloud-download" className="no-messages-icon" />
        <h3 className="title">{lang('ConversationCloudStorageInfoTitle')}</h3>
        <ul className="description">
          <li>{lang('ConversationClousStorageInfoDescription1')}</li>
          <li>{lang('ConversationClousStorageInfoDescription2')}</li>
          <li>{lang('ConversationClousStorageInfoDescription3')}</li>
          <li>{lang('ConversationClousStorageInfoDescription4')}</li>
        </ul>
      </div>
    </div>
  );
}

function renderGroup(lang: LangFn) {
  return (
    <div className="NoMessages">
      <div className="wrapper" dir={lang.isRtl ? 'rtl' : undefined}>
        <h3 className="title">{lang('EmptyGroupInfoTitle')}</h3>
        <p className="description">{lang('EmptyGroupInfoSubtitle')}</p>
        <ul className="list-checkmarks">
          <li>{lang('EmptyGroupInfoLine1', { count: GROUP_MEMBERS_LIMIT })}</li>
          <li>{lang('EmptyGroupInfoLine2')}</li>
          <li>{lang('EmptyGroupInfoLine3')}</li>
          <li>{lang('EmptyGroupInfoLine4')}</li>
        </ul>
      </div>
    </div>
  );
}

export default memo(NoMessages);
