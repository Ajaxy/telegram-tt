import React, { FC } from '../../../lib/teact/teact';

import { ApiKeyboardButton, ApiMessage } from '../../../api/types';

import { RE_TME_LINK } from '../../../config';

import Button from '../../ui/Button';

import './InlineButtons.scss';

type OwnProps = {
  message: ApiMessage;
  onClick: ({ button }: { button: ApiKeyboardButton }) => void;
};

const InlineButtons: FC<OwnProps> = ({ message, onClick }) => {
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
              {button.text}
              {button.type === 'url' && !button.value!.match(RE_TME_LINK) && <i className="icon-arrow-right" />}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default InlineButtons;
