import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

type OwnProps = {
  isOpen?: boolean;
  text: string;
  isDisabled?: boolean;
  onClick: VoidFunction;
};

const BotMenuButton = ({
  isOpen,
  onClick,
  text,
  isDisabled,
}: OwnProps) => {
  const lang = useLang();
  const textRef = useRef<HTMLSpanElement>();

  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;

    const width = textEl.scrollWidth + 1; // Make width slightly bigger prevent ellipsis in some cases

    const composerEl = textEl.closest('.Composer') as HTMLElement;
    requestMutation(() => {
      composerEl.style.setProperty('--bot-menu-text-width', `${width}px`);
    });

    return () => {
      requestMutation(() => {
        composerEl.style.removeProperty('--bot-menu-text-width');
      });
    };
  }, [isOpen, text]);

  return (
    <Button
      className={buildClassName('composer-action-button bot-menu', isOpen && 'open')}
      round
      color="translucent"
      disabled={isDisabled}
      onClick={onClick}
      ariaLabel={lang('AriaOpenBotMenu')}
    >
      <Icon name="webapp" className={buildClassName('bot-menu-icon', isOpen && 'open')} />
      <span ref={textRef} className="bot-menu-text">{renderText(text)}</span>
    </Button>
  );
};

export default memo(BotMenuButton);
