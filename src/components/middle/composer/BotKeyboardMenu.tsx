import type { TeactNode } from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ThreadId } from '../../../types';

import { selectChatMessage, selectCurrentMessageList } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import renderKeyboardButtonText from './helpers/renderKeyboardButtonText';

import useLang from '../../../hooks/useLang';
import useMouseInside from '../../../hooks/useMouseInside';

import CustomEmoji from '../../common/CustomEmoji';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';

import styles from './BotKeyboardMenu.module.scss';

export type OwnProps = {
  isOpen: boolean;
  messageId: number;
  threadId?: ThreadId;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  message?: ApiMessage;
};

const ICON_SIZE = 16;

const BotKeyboardMenu = ({
  isOpen, threadId, message, onClose,
}: OwnProps & StateProps) => {
  const { clickBotInlineButton } = getActions();

  const lang = useLang();

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
      className={styles.root}
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCompact
    >
      <div className={buildClassName(styles.content, 'custom-scroll')}>
        {message.keyboardButtons.map((row, i) => (
          <div className={styles.row}>
            {row.map((button, j) => (
              <Button
                className={buildClassName(
                  styles.button,
                  button.style?.type && styles[`${button.style.type}Tint`],
                )}
                ripple
                noForcedUpperCase
                disabled={button.type === 'unsupported'}
                onClick={() => clickBotInlineButton({
                  chatId: message.chatId, messageId: message.id, threadId, button,
                })}
              >
                <span className={styles.inlineButtonText}>
                  {button.style?.iconId && (
                    <CustomEmoji
                      className={styles.customEmojiIcon}
                      documentId={button.style.iconId}
                      size={ICON_SIZE}
                    />
                  )}
                  {buttonTexts?.[i][j]}
                </span>
              </Button>
            ))}
          </div>
        ))}
      </div>
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { messageId }): Complete<StateProps> => {
    const { chatId } = selectCurrentMessageList(global) || {};

    const message = chatId ? selectChatMessage(global, chatId, messageId) : undefined;
    return {
      message,
    };
  },
)(BotKeyboardMenu));
