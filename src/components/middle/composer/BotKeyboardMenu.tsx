import React, { FC, memo, useEffect } from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiMessage } from '../../../api/types';

import { IS_TOUCH_ENV } from '../../../util/environment';
import { selectChatMessage, selectCurrentMessageList } from '../../../modules/selectors';
import useMouseInside from '../../../hooks/useMouseInside';
import useFlag from '../../../hooks/useFlag';

import Menu from '../../ui/Menu';
import Button from '../../ui/Button';

import './BotKeyboardMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  messageId: number;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  message?: ApiMessage;
};

const BotKeyboardMenu: FC<OwnProps & StateProps> = ({
  isOpen, message, onClose,
}) => {
  const { clickInlineButton } = getDispatch();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);
  const { isKeyboardSingleUse } = message || {};
  const [forceOpen, markForceOpen, unmarkForceOpen] = useFlag(true);

  const handleClose = () => {
    unmarkForceOpen();
    onClose();
  };

  useEffect(() => {
    markForceOpen();
  }, [markForceOpen, message?.keyboardButtons]);

  if (!message || !message.keyboardButtons) {
    return undefined;
  }

  return (
    <Menu
      isOpen={isOpen || forceOpen}
      autoClose={isKeyboardSingleUse}
      positionX="right"
      positionY="bottom"
      onClose={handleClose}
      className="BotKeyboardMenu"
      onCloseAnimationEnd={handleClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
    >
      <div className="content">
        {message.keyboardButtons.map((row) => (
          <div className="row">
            {row.map((button) => (
              <Button
                ripple
                disabled={button.type === 'NOT_SUPPORTED'}
                onClick={() => clickInlineButton({ button })}
              >
                {button.text}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { messageId }): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    if (!chatId) {
      return {};
    }

    return { message: selectChatMessage(global, chatId, messageId) };
  },
)(BotKeyboardMenu));
