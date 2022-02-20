import React, { FC, memo, useCallback, useRef } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';
import { TextPart } from '../common/helpers/renderMessageText';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';

import Modal from './Modal';
import Button from './Button';

type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  title?: string;
  header?: FC;
  textParts?: TextPart[];
  text?: string;
  confirmLabel?: string;
  confirmHandler: () => void;
  confirmIsDestructive?: boolean;
  isButtonsInOneRow?: boolean;
  children?: any;
};

const ConfirmDialog: FC<OwnProps> = ({
  isOpen,
  onClose,
  onCloseAnimationEnd,
  title,
  header,
  text,
  textParts,
  confirmLabel = 'Confirm',
  confirmHandler,
  confirmIsDestructive,
  isButtonsInOneRow,
  children,
}) => {
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelectWithEnter = useCallback((index: number) => {
    if (index === -1) confirmHandler();
  }, [confirmHandler]);

  const handleKeyDown = useKeyboardListNavigation(containerRef, isOpen, handleSelectWithEnter, '.Button');

  return (
    <Modal
      className="confirm"
      title={title}
      header={header}
      isOpen={isOpen}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {text && text.split('\\n').map((textPart) => (
        <p>{textPart}</p>
      ))}
      {textParts || children}
      <div className={isButtonsInOneRow ? 'dialog-buttons mt-2' : ''} ref={containerRef} onKeyDown={handleKeyDown}>
        <Button
          className="confirm-dialog-button"
          isText
          onClick={confirmHandler}
          color={confirmIsDestructive ? 'danger' : 'primary'}
        >
          {confirmLabel}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(ConfirmDialog);
