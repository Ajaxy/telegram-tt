import type { FC, TeactNode } from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { selectChatMessage, selectCurrentMessageList } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import renderKeyboardButtonText from './helpers/renderKeyboardButtonText';

import useMouseInside from '../../../hooks/useMouseInside';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';
import Menu from '../../ui/Menu';

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
  const { clickBotInlineButton } = getActions();

  const lang = useOldLang();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);
  const { isKeyboardSingleUse } = message || {};

  const buttonTexts = useMemo(() => {
    const texts: TeactNode[][] = [];
    message?.keyboardButtons!.forEach((row) => {
      texts.push(row.map((button) => renderKeyboardButtonText(lang, button)));
    });

    return texts;
  }, [lang, message?.keyboardButtons]);

  if (!message || !message.keyboardButtons) {
    return undefined;
  }

  return (
    <Menu
      isOpen={isOpen}
      autoClose={isKeyboardSingleUse}
      positionX="right"
      positionY="bottom"
      onClose={onClose}
      className="BotKeyboardMenu"
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCompact
    >
      <div className="content custom-scroll">
        {message.keyboardButtons.map((row, i) => (
          <div className="row">
            {row.map((button, j) => (
              <Button
                ripple
                disabled={button.type === 'unsupported'}

                onClick={() => clickBotInlineButton({ chatId: message.chatId, messageId: message.id, button })}
              >
                {buttonTexts?.[i][j]}
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
