import React, { FC } from '../../../lib/teact/teact';

import { ApiKeyboardButton, ApiMessage } from '../../../api/types';

import { RE_TME_LINK } from '../../../config';
import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';

import './InlineButtons.scss';

type OwnProps = {
  message: ApiMessage;
  onClick: ({ messageId, button }: { messageId: number; button: ApiKeyboardButton }) => void;
};

const InlineButtons: FC<OwnProps> = ({ message, onClick }) => {
  const lang = useLang();
  return (
    <div className="InlineButtons">
      {message.inlineButtons!.map((row) => (
        <div className="row">
          {row.map((button) => (
            <Button
              size="tiny"
              ripple
              disabled={button.type === 'unsupported'}
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => onClick({ messageId: message.id, button })}
            >
              <span className="inline-button-text">{renderText(lang(button.text))}</span>
              {['buy', 'receipt'].includes(button.type) && <i className="icon-card" />}
              {button.type === 'url' && !RE_TME_LINK.test(button.url) && <i className="icon-arrow-right" />}
              {button.type === 'switchBotInline' && <i className="icon-share-filled" />}
              {['webView', 'simpleWebView'].includes(button.type) && <i className="icon-webapp" />}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default InlineButtons;
