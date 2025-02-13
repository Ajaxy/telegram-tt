import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { beginHeavyAnimation, useEffect } from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import freezeWhenClosed from '../../util/hoc/freezeWhenClosed';
import trapFocus from '../../util/trapFocus';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLastCallback from '../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useOldLang from '../../hooks/useOldLang';
import useShowTransition from '../../hooks/useShowTransition';

import Icon from '../common/icons/Icon';
import Button, { type OwnProps as ButtonProps } from './Button';
import Portal from './Portal';

import './Modal.scss';

export const ANIMATION_DURATION = 200;

export type OwnProps = {
  title?: string | TextPart[];
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  isOpen?: boolean;
  header?: TeactNode;
  isSlim?: boolean;
  hasCloseButton?: boolean;
  hasAbsoluteCloseButton?: boolean;
  absoluteCloseButtonColor?: ButtonProps['color'];
  noBackdrop?: boolean;
  noBackdropClose?: boolean;
  children: React.ReactNode;
  style?: string;
  dialogStyle?: string;
  dialogRef?: React.RefObject<HTMLDivElement>;
  isLowStackPriority?: boolean;
  dialogContent?: React.ReactNode;
  ignoreFreeze?: boolean;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  onEnter?: () => void;
};

const Modal: FC<OwnProps> = ({
  dialogRef,
  title,
  className,
  contentClassName,
  headerClassName,
  isOpen,
  isSlim,
  header,
  hasCloseButton,
  hasAbsoluteCloseButton,
  absoluteCloseButtonColor = 'translucent',
  noBackdrop,
  noBackdropClose,
  children,
  style,
  dialogStyle,
  isLowStackPriority,
  dialogContent,
  onClose,
  onCloseAnimationEnd,
  onEnter,
}) => {
  const {
    ref: modalRef,
    shouldRender,
  } = useShowTransition({
    isOpen,
    onCloseAnimationEnd,
    withShouldRender: true,
  });

  const withCloseButton = hasCloseButton || hasAbsoluteCloseButton;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    disableDirectTextInput();

    return enableDirectTextInput;
  }, [isOpen]);

  const handleEnter = useLastCallback((e: KeyboardEvent) => {
    if (!onEnter) {
      return false;
    }

    e.preventDefault();
    onEnter();
    return true;
  });

  useEffect(() => (
    isOpen ? captureKeyboardListeners({ onEsc: onClose, onEnter: handleEnter }) : undefined
  ), [isOpen, onClose, handleEnter]);
  useEffect(() => (isOpen && modalRef.current ? trapFocus(modalRef.current) : undefined), [isOpen, modalRef]);

  useHistoryBack({
    isActive: isOpen,
    onBack: onClose,
  });

  useLayoutEffectWithPrevDeps(([prevIsOpen]) => {
    document.body.classList.toggle('has-open-dialog', Boolean(isOpen));

    if (isOpen || (!isOpen && prevIsOpen !== undefined)) {
      beginHeavyAnimation(ANIMATION_DURATION);
    }

    return () => {
      document.body.classList.remove('has-open-dialog');
    };
  }, [isOpen]);

  const lang = useOldLang();

  if (!shouldRender) {
    return undefined;
  }

  function renderHeader() {
    if (header) {
      return header;
    }

    if (!title && !withCloseButton) return undefined;
    const closeButton = (
      <Button
        className={buildClassName(hasAbsoluteCloseButton && 'modal-absolute-close-button')}
        round
        color={absoluteCloseButtonColor}
        size="smaller"
        ariaLabel={lang('Close')}
        onClick={onClose}
      >
        <Icon name="close" />
      </Button>
    );

    if (hasAbsoluteCloseButton) {
      return closeButton;
    }

    return (
      <div className={buildClassName('modal-header', headerClassName)}>
        {withCloseButton && closeButton}
        <div className="modal-title">{title}</div>
      </div>
    );
  }

  const fullClassName = buildClassName(
    'Modal',
    className,
    noBackdrop && 'transparent-backdrop',
    isSlim && 'slim',
    isLowStackPriority && 'low-priority',
  );

  return (
    <Portal>
      <div
        ref={modalRef}
        className={fullClassName}
        tabIndex={-1}
        role="dialog"
      >
        <div className="modal-container">
          <div className="modal-backdrop" onClick={!noBackdropClose ? onClose : undefined} />
          <div className="modal-dialog" ref={dialogRef} style={dialogStyle}>
            {renderHeader()}
            {dialogContent}
            <div className={buildClassName('modal-content custom-scroll', contentClassName)} style={style}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default freezeWhenClosed(Modal);
