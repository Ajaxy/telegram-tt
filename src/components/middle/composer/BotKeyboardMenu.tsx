import React, { FC, memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiMessage } from '../../../api/types';

import { IS_TOUCH_ENV } from '../../../util/environment';
import { pick } from '../../../util/iteratees';
import { selectChatMessage, selectCurrentMessageList } from '../../../modules/selectors';
import useMouseInside from '../../../hooks/useMouseInside';

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

type DispatchProps = Pick<GlobalActions, ('clickInlineButton')>;

const BotKeyboardMenu: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen, message, onClose, clickInlineButton,
}) => {
  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);

  if (!message || !message.keyboardButtons) {
    return undefined;
  }

  return (
    <Menu
      isOpen={isOpen}
      autoClose
      positionX="right"
      positionY="bottom"
      onClose={onClose}
      className="KeyboardMenu"
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'clickInlineButton',
  ]),
)(BotKeyboardMenu));
