import type { FC, TeactNode } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import { memo, useCallback, useRef } from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import buildClassName from '../../util/buildClassName';

import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useLang from '../../hooks/useLang';

import Button from './Button';
import Modal from './Modal';

type OwnProps = {
  isOpen: boolean;
  title?: string;
  noDefaultTitle?: boolean;
  header?: TeactNode;
  textParts?: TextPart;
  text?: string;
  confirmLabel?: TeactNode;
  confirmIsDestructive?: boolean;
  isConfirmDisabled?: boolean;
  isOnlyConfirm?: boolean;
  areButtonsInColumn?: boolean;
  className?: string;
  children?: React.ReactNode;
  confirmHandler: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const ConfirmDialog: FC<OwnProps> = ({
  isOpen,
  title,
  noDefaultTitle,
  header,
  text,
  textParts,
  confirmLabel,
  confirmIsDestructive,
  isConfirmDisabled,
  isOnlyConfirm,
  areButtonsInColumn,
  className,
  children,
  confirmHandler,
  onClose,
  onCloseAnimationEnd,
}) => {
  const lang = useLang();

  const containerRef = useRef<HTMLDivElement>();

  const handleSelectWithEnter = useCallback((index: number) => {
    if (index === -1) confirmHandler();
  }, [confirmHandler]);

  const handleKeyDown = useKeyboardListNavigation(containerRef, isOpen, handleSelectWithEnter, '.Button');

  return (
    <Modal
      className={buildClassName('confirm', className)}
      title={(title || (!noDefaultTitle ? lang('Telegram') : undefined))}
      header={header}
      isOpen={isOpen}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {text && text.split('\\n').map((textPart) => (
        <p>{textPart}</p>
      ))}
      {textParts || children}
      <div
        className={areButtonsInColumn ? 'dialog-buttons-column' : 'dialog-buttons mt-2'}
        ref={containerRef}
        onKeyDown={handleKeyDown}
      >
        <Button
          className="confirm-dialog-button"
          isText
          onClick={confirmHandler}
          color={confirmIsDestructive ? 'danger' : 'primary'}
          disabled={isConfirmDisabled}
        >
          {confirmLabel || lang('GeneralConfirm')}
        </Button>
        {!isOnlyConfirm && <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>}
      </div>
    </Modal>
  );
};

export default memo(ConfirmDialog);
