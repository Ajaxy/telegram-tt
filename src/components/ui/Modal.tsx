import type { RefObject } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { useEffect, useRef } from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import trapFocus from '../../util/trapFocus';
import buildClassName from '../../util/buildClassName';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useShowTransition from '../../hooks/useShowTransition';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

import Button from './Button';
import Portal from './Portal';

import './Modal.scss';

const ANIMATION_DURATION = 200;

type OwnProps = {
  title?: string | TextPart[];
  className?: string;
  isOpen?: boolean;
  header?: TeactNode;
  hasCloseButton?: boolean;
  noBackdrop?: boolean;
  children: React.ReactNode;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  onEnter?: () => void;
  dialogRef?: RefObject<HTMLDivElement>;
};

type StateProps = {
  shouldSkipHistoryAnimations?: boolean;
};

const Modal: FC<OwnProps & StateProps> = ({
  dialogRef,
  title,
  className,
  isOpen,
  header,
  hasCloseButton,
  noBackdrop,
  children,
  onClose,
  onCloseAnimationEnd,
  onEnter,
  shouldSkipHistoryAnimations,
}) => {
  const {
    shouldRender,
    transitionClassNames,
  } = useShowTransition(
    isOpen, onCloseAnimationEnd, shouldSkipHistoryAnimations, undefined, shouldSkipHistoryAnimations,
  );
  // eslint-disable-next-line no-null/no-null
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => (isOpen
    ? captureKeyboardListeners({ onEsc: onClose, onEnter })
    : undefined), [isOpen, onClose, onEnter]);
  useEffect(() => (isOpen && modalRef.current ? trapFocus(modalRef.current) : undefined), [isOpen]);

  useHistoryBack({
    isActive: isOpen,
    onBack: onClose,
  });

  useEffectWithPrevDeps(([prevIsOpen]) => {
    document.body.classList.toggle('has-open-dialog', isOpen);
    if (isOpen || (!isOpen && prevIsOpen !== undefined)) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION);
    }

    return () => {
      document.body.classList.remove('has-open-dialog');
    };
  }, [isOpen]);

  const lang = useLang();

  if (!shouldRender) {
    return undefined;
  }

  function renderHeader() {
    if (header) {
      return header;
    }

    if (!title) {
      return undefined;
    }

    return (
      <div className="modal-header">
        {hasCloseButton && (
          <Button
            round
            color="translucent"
            size="smaller"
            ariaLabel={lang('Close')}
            onClick={onClose}
          >
            <i className="icon-close" />
          </Button>
        )}
        <div className="modal-title">{title}</div>
      </div>
    );
  }

  const fullClassName = buildClassName(
    'Modal',
    className,
    transitionClassNames,
    noBackdrop && 'transparent-backdrop',
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
          <div className="modal-backdrop" onClick={onClose} />
          <div className="modal-dialog" ref={dialogRef}>
            {renderHeader()}
            <div className="modal-content custom-scroll">
              {children}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default Modal;
