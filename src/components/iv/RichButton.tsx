import { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiRichButton } from '../../api/types';
import type { IconName } from '../../types/icons';
import type { RichTextProps } from './RichText';

import { isButtonUnsupported } from '../../global/helpers/buttons';
import { isKeyboardButtonUnsupportedForEphemeral } from '../../global/helpers/ephemeralMessages';
import { getRichTextPlainText } from '../../global/helpers/richMessage';
import { selectChatMessageOrEphemeral } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import RichText from './RichText';

import styles from './RichContent.module.scss';

type OwnProps = {
  button: ApiRichButton;
  isInline?: boolean;
} & Omit<RichTextProps, 'text'>;

type StateProps = {
  isReceipt?: boolean;
  isEphemeral?: boolean;
};

export const RICH_BUTTON_ICONS: Partial<Record<ApiRichButton['action']['type'], IconName>> = {
  url: 'arrow-right',
  urlAuth: 'arrow-right',
  switchBotInline: 'share-filled',
  copy: 'copy',
  userProfile: 'user-filled',
  webView: 'webapp',
  buy: 'card',
};

const RichButton = ({
  button, isInline, isReceipt, isEphemeral, ...context
}: OwnProps & StateProps) => {
  const { clickBotInlineButton } = getActions();
  const lang = useLang();
  const { chatId, messageId, threadId } = context;
  const { text } = button;
  const isLink = isInline && button.action.type === 'callback' && button.style?.isLink;
  const icon = !isInline && RICH_BUTTON_ICONS[button.action.type];
  const keyboardButton = useMemo(() => ({
    action: button.action, text: getRichTextPlainText(text),
  }), [button.action, text]);
  const isDisabled = isButtonUnsupported(button.action)
    || (isEphemeral && isKeyboardButtonUnsupportedForEphemeral(keyboardButton))
    || ((!chatId || messageId === undefined) && !['url', 'copy', 'userProfile'].includes(button.action.type));

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    clickBotInlineButton({ chatId, messageId, threadId, button: keyboardButton });
  });

  const handleMouseDown = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  });

  return (
    <button
      type="button"
      className={buildClassName(
        styles.richButton,
        icon && styles.hasButtonIcon,
        isInline && styles.inlineRichButton,
        button.style?.type && styles[`${button.style.type}Button`],
        isLink && styles.linkButton,
      )}
      disabled={isDisabled}
      data-rich-button={JSON.stringify({
        action: button.action.type === 'callback' ? { type: 'disabled' } : button.action,
        style: button.style,
      })}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <span className={styles.buttonLabel}>
        {button.action.type === 'buy' && isReceipt ? lang('PaymentReceipt') : (
          <RichText text={text} {...context} isButtonLabel />
        )}
      </span>
      {icon && (
        <Icon
          name={icon}
          className={buildClassName(styles.buttonIcon, icon === 'arrow-right' && styles.externalButtonIcon)}
        />
      )}
    </button>
  );
};

export default memo(withGlobal<OwnProps>((global, { chatId, messageId }): Complete<StateProps> => {
  const message = chatId && messageId !== undefined
    ? selectChatMessageOrEphemeral(global, chatId, messageId) : undefined;
  return {
    isReceipt: Boolean(message?.content.invoice?.receiptMessageId),
    isEphemeral: message?.isEphemeral,
  };
})(RichButton));
