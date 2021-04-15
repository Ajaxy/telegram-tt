import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiChat } from '../../api/types';

import { selectChat } from '../../modules/selectors';
import { getChatDescription, getChatLink } from '../../modules/helpers';
import renderText from '../common/helpers/renderText';
import useLang from '../../hooks/useLang';

import SafeLink from '../common/SafeLink';

type OwnProps = {
  chatId: number;
};

type StateProps = {
  chat?: ApiChat;
};

const ChatExtra: FC<OwnProps & StateProps> = ({ chat }) => {
  const lang = useLang();

  if (!chat || chat.isRestricted) {
    return undefined;
  }

  const description = getChatDescription(chat);
  const link = getChatLink(chat);
  const url = link.indexOf('http') === 0 ? link : `http://${link}`;

  return (
    <div className="ChatExtra">
      {description && !!description.length && (
        <div className="item">
          <i className="icon-info" />
          <div>
            <p className="title">{renderText(description, ['br', 'links', 'emoji'])}</p>
            <p className="subtitle">{lang('Info')}</p>
          </div>
        </div>
      )}
      {!!link.length && (
        <div className="item">
          <i className="icon-mention" />
          <div>
            <SafeLink url={url} className="title" text={link} />
            <p className="subtitle">{lang('SetUrlPlaceholder')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);

    return { chat };
  },
)(ChatExtra));
