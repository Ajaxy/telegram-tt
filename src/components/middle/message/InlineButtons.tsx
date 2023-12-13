import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { ApiKeyboardButton, ApiMessage } from '../../../api/types';

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

  const renderIcon = (button: ApiKeyboardButton) => {
    const { type } = button;
    switch (type) {
      case 'url': {
        if (!RE_TME_LINK.test(button.url)) {
          return <i className="icon icon-arrow-right" />;
        }
        break;
      }
      case 'urlAuth':
        return <i className="icon icon-arrow-right" />;
      case 'buy':
      case 'receipt':
        return <i className="icon icon-cart" />;
      case 'switchBotInline':
        return <i className="icon icon-share-filled" />;
      case 'webView':
      case 'simpleWebView':
        return <i className="icon icon-webapp" />;
    }
    return undefined;
  };

  return (
    <div className="InlineButtons">
      {message.inlineButtons!.map((row) => (
        <div className="row">
          {row.map((button) => (
            <Button
              size="tiny"
              ripple
              isText
              disabled={button.type === 'unsupported'}
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => onClick({ messageId: message.id, button })}
            >
              <span className="inline-button-text">{renderText(lang(button.text))}</span>
              {renderIcon(button)}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default InlineButtons;
