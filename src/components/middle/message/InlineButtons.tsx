import type { FC, TeactNode } from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiKeyboardButton, ApiMessage } from '../../../api/types';
import type { ActionPayloads } from '../../../global/types';

import { RE_TME_LINK } from '../../../config';
import renderKeyboardButtonText from '../composer/helpers/renderKeyboardButtonText';

import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import './InlineButtons.scss';

type OwnProps = {
  message: ApiMessage;
  onClick: (payload: ActionPayloads['clickBotInlineButton']) => void;
};

const InlineButtons: FC<OwnProps> = ({ message, onClick }) => {
  const lang = useOldLang();

  const renderIcon = (button: ApiKeyboardButton) => {
    const { type } = button;
    switch (type) {
      case 'url': {
        if (!RE_TME_LINK.test(button.url)) {
          return <Icon className="corner-icon" name="arrow-right" />;
        }
        break;
      }
      case 'urlAuth':
        return <Icon className="corner-icon" name="arrow-right" />;
      case 'buy':
      case 'receipt':
        return <Icon className="corner-icon" name="card" />;
      case 'switchBotInline':
        return <Icon className="corner-icon" name="share-filled" />;
      case 'webView':
      case 'simpleWebView':
        return <Icon className="corner-icon" name="webapp" />;
      case 'copy':
        return <Icon className="corner-icon" name="copy" />;
      case 'suggestedMessage':
        if (button.buttonType === 'suggestChanges') {
          return <Icon className="left-icon" name="edit" />;
        }
        if (button.buttonType === 'approve') {
          return <Icon className="left-icon" name="check" />;
        }
        if (button.buttonType === 'decline') {
          return <Icon className="left-icon" name="close" />;
        }
        break;
    }
    return undefined;
  };

  const buttonTexts = useMemo(() => {
    const texts: TeactNode[][] = [];
    message.inlineButtons!.forEach((row) => {
      texts.push(row.map((button) => renderKeyboardButtonText(lang, button)));
    });
    return texts;
  }, [lang, message.inlineButtons]);

  return (
    <div className="InlineButtons">
      {message.inlineButtons!.map((row, i) => (
        <div className="row">
          {row.map((button, j) => (
            <Button
              size="tiny"
              ripple
              disabled={button.type === 'unsupported' || (button.type === 'suggestedMessage' && button.disabled)}

              onClick={() => onClick({ chatId: message.chatId, messageId: message.id, button })}
            >
              {renderIcon(button)}
              <span className="inline-button-text">
                {buttonTexts[i][j]}
              </span>
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default memo(InlineButtons);
