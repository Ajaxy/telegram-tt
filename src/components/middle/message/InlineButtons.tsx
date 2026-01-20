import type { TeactNode } from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiKeyboardButton } from '../../../api/types';

import { RE_TME_LINK, TME_LINK_PREFIX } from '../../../config';
import renderKeyboardButtonText from '../composer/helpers/renderKeyboardButtonText';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import './InlineButtons.scss';

type OwnProps = {
  inlineButtons: ApiKeyboardButton[][];
  onClick: (payload: ApiKeyboardButton) => void;
};

const InlineButtons = ({ inlineButtons, onClick }: OwnProps) => {
  const lang = useLang();

  const renderIcon = (button: ApiKeyboardButton) => {
    const { type } = button;
    switch (type) {
      case 'url': {
        const { url } = button;

        if (url.startsWith(TME_LINK_PREFIX) && url.includes('?startapp')) {
          return <Icon className="corner-icon" name="webapp" />;
        } else if (!RE_TME_LINK.test(url)) {
          return <Icon className="corner-icon" name="arrow-right" />;
        }

        return;
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
      case 'giftOffer':
        if (button.buttonType === 'accept') {
          return <Icon className="left-icon" name="check" />;
        }
        if (button.buttonType === 'reject') {
          return <Icon className="left-icon" name="close" />;
        }
        break;
    }

    return;
  };

  const buttonTexts = useMemo(() => {
    const texts: TeactNode[][] = [];
    inlineButtons.forEach((row) => {
      texts.push(row.map((button) => renderKeyboardButtonText(lang, button)));
    });
    return texts;
  }, [lang, inlineButtons]);

  return (
    <div className="InlineButtons">
      {inlineButtons.map((row, i) => (
        <div className="row">
          {row.map((button, j) => (
            <Button
              size="tiny"
              ripple
              disabled={button.type === 'unsupported' || (button.type === 'suggestedMessage' && button.disabled)}

              onClick={() => onClick(button)}
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
