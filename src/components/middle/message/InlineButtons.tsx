import React, { FC } from '../../../lib/teact/teact';

import { ApiKeyboardButton, ApiMessage } from '../../../api/types';

import { RE_TME_LINK } from '../../../config';
import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';

import './InlineButtons.scss';

type OwnProps = {
  message: ApiMessage;
  onClick: ({ button }: { button: ApiKeyboardButton }) => void;
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
              disabled={button.type === 'NOT_SUPPORTED'}
              onClick={() => onClick({ button })}
            >
              {renderText(lang(button.text))}
              {button.type === 'buy' && <i className="icon-card" />}
              {button.type === 'url' && !button.value!.match(RE_TME_LINK) && <i className="icon-arrow-right" />}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default InlineButtons;
