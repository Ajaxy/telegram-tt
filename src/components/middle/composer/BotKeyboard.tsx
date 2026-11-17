import type { TeactNode } from '../../../lib/teact/teact';
import { memo, useEffect, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiKeyboardButton, ApiMessage } from '../../../api/types';
import type { ThreadId } from '../../../types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { isKeyboardButtonUnsupportedForEphemeral } from '../../../global/helpers';
import { isButtonUnsupported } from '../../../global/helpers/buttons';
import { selectChatMessageOrEphemeral } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderKeyboardButtonText from './helpers/renderKeyboardButtonText';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useScrollableHint from '../../../hooks/useScrollableHint';

import CustomEmoji from '../../common/CustomEmoji';
import Button from '../../ui/Button';

import styles from './BotKeyboard.module.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  messageId?: number;
  isOpen: boolean;
  isSymbolMenuOpen?: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  message?: ApiMessage;
};

const ICON_SIZE = 16;

const BotKeyboard = ({
  threadId, isOpen, isSymbolMenuOpen, message, onClose,
}: OwnProps & StateProps) => {
  const { clickBotInlineButton } = getActions();

  const lang = useLang();

  const scrollerRef = useRef<HTMLDivElement>();

  const renderedMessage = useCurrentOrPrev(message, true);
  const keyboardButtons = renderedMessage?.keyboardButtons;

  const { updateScrollableHint } = useScrollableHint(scrollerRef, { isDisabled: !keyboardButtons });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    requestMutation(() => {
      scroller.scrollTop = 0;
    });
  }, [renderedMessage?.id]);

  useEffect(() => {
    updateScrollableHint();
  }, [keyboardButtons, updateScrollableHint]);

  const buttonTexts = useMemo(() => {
    const texts: TeactNode[][] = [];
    keyboardButtons?.forEach((row) => {
      texts.push(row.map((button) => renderKeyboardButtonText(lang, button)));
    });

    return texts;
  }, [lang, keyboardButtons]);

  const handleButtonClick = useLastCallback((button: ApiKeyboardButton) => {
    clickBotInlineButton({
      chatId: renderedMessage!.chatId, messageId: renderedMessage!.id, threadId, button,
    });

    if (renderedMessage!.isKeyboardSingleUse) {
      onClose();
    }
  });

  return (
    <div
      className={buildClassName(
        styles.root,
        isOpen && styles.open,
        isSymbolMenuOpen && styles.symbolMenuOpen,
        renderedMessage?.isKeyboardFullHeight && styles.fullSize,
      )}
      style={`--bot-keyboard-rows: ${keyboardButtons?.length || 0}`}
      data-bot-keyboard
      inert={!isOpen}
      aria-hidden={!isOpen}
    >
      {keyboardButtons && (
        <div className={styles.island}>
          <div ref={scrollerRef} className={buildClassName(styles.scroller, 'custom-scroll')}>
            {keyboardButtons.map((row, i) => (
              <div className={styles.row}>
                {row.map((button, j) => (
                  <Button
                    className={buildClassName(
                      styles.button,
                      button.style?.type && styles[`${button.style.type}Tint`],
                    )}
                    size="tiny"
                    ripple
                    noFastClick
                    noForcedUpperCase
                    disabled={isButtonUnsupported(button.action)
                      || (renderedMessage.isEphemeral && isKeyboardButtonUnsupportedForEphemeral(button))}
                    onClick={() => handleButtonClick(button)}
                  >
                    <span className={styles.buttonText}>
                      {button.style?.iconId && (
                        <CustomEmoji
                          className={styles.customEmojiIcon}
                          documentId={button.style.iconId}
                          size={ICON_SIZE}
                        />
                      )}
                      {buttonTexts[i][j]}
                    </span>
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, messageId }): Complete<StateProps> => {
    const message = messageId ? selectChatMessageOrEphemeral(global, chatId, messageId) : undefined;

    return {
      message,
    };
  },
)(BotKeyboard));
