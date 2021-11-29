import React, { FC, memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';
import { TextPart } from '../common/helpers/renderMessageText';

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

  return (
    <Modal
      className="confirm"
      title={title}
      header={header}
      isOpen={isOpen}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      onEnter={confirmHandler}
    >
      {text && text.split('\\n').map((textPart) => (
        <p>{textPart}</p>
      ))}
      {textParts || children}
      <div className={isButtonsInOneRow ? 'dialog-buttons mt-2' : ''}>
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
