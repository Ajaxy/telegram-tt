import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { MessageListType } from '../../global/types';

import type { LangFn } from '../../hooks/useLang';
import useLang from '../../hooks/useLang';

import './NoMessages.scss';

type OwnProps = {
  chatId: string;
  isChatWithSelf?: boolean;
  type: MessageListType;
  isGroupChatJustCreated?: boolean;
};

const NoMessages: FC<OwnProps> = ({
  isChatWithSelf, type, isGroupChatJustCreated,
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

  return (
    <div className="empty"><span>{lang('NoMessages')}</span></div>
  );
};

function renderScheduled(lang: LangFn) {
  return (
    <div className="empty"><span>{lang('ScheduledMessages.EmptyPlaceholder')}</span></div>
  );
}

function renderSavedMessages(lang: LangFn) {
  return (
    <div className="NoMessages">
      <div className="wrapper">
        <i className="icon icon-cloud-download" />
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
