import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

type OwnProps = {
  isOpen?: boolean;
  onClick: VoidFunction;
  text: string;
  isDisabled?: boolean;
};

const BotMenuButton: FC<OwnProps> = ({
  isOpen,
  onClick,
  text,
  isDisabled,
}) => {
  // eslint-disable-next-line no-null/no-null
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;

    const width = textEl.scrollWidth + 1; // Make width slightly bigger prevent ellipsis in some cases

    const composerEl = textEl.closest('.Composer') as HTMLElement;
    composerEl.style.setProperty('--bot-menu-text-width', `${width}px`);
  }, [isOpen, text]);

  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return undefined;

    const composerEl = textEl.closest('.Composer') as HTMLElement;

    return () => {
      composerEl.style.removeProperty('--bot-menu-text-width');
    };
  }, []);

  return (
    <Button
      className={buildClassName('composer-action-button bot-menu', isOpen && 'open')}
      round
      color="translucent"
      disabled={isDisabled}
      onClick={onClick}
      ariaLabel="Open bot command keyboard"
    >
      <Icon name="webapp" className={buildClassName('bot-menu-icon', isOpen && 'open')} />
      <span ref={textRef} className="bot-menu-text">{renderText(text)}</span>
    </Button>
  );
};

export default memo(BotMenuButton);
