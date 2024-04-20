import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { useEffect, useRef } from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import freezeWhenClosed from '../../util/hoc/freezeWhenClosed';
import trapFocus from '../../util/trapFocus';

import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useShowTransition from '../../hooks/useShowTransition';

import Button from './Button';
import Portal from './Portal';

import './Modal.scss';

export const ANIMATION_DURATION = 200;

type OwnProps = {
  title?: string | TextPart[];
  className?: string;
  contentClassName?: string;
  isOpen?: boolean;
  header?: TeactNode;
  isSlim?: boolean;
  hasCloseButton?: boolean;
  noBackdrop?: boolean;
  noBackdropClose?: boolean;
  children: React.ReactNode;
  style?: string;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  onEnter?: () => void;
  dialogRef?: React.RefObject<HTMLDivElement>;
};

type StateProps = {
  shouldSkipHistoryAnimations?: boolean;
};

const Modal: FC<OwnProps & StateProps> = ({
  dialogRef,
  title,
  className,
  contentClassName,
  isOpen,
  isSlim,
  header,
  hasCloseButton,
  noBackdrop,
  noBackdropClose,
  children,
  style,
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
  useEffect(() => (isOpen && modalRef.current ? trapFocus(modalRef.current) : undefined), [isOpen]);

  useHistoryBack({
    isActive: isOpen,
    onBack: onClose,
  });

  useLayoutEffectWithPrevDeps(([prevIsOpen]) => {
    document.body.classList.toggle('has-open-dialog', Boolean(isOpen));

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
            <i className="icon icon-close" />
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
    isSlim && 'slim',
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
          <div className="modal-dialog" ref={dialogRef}>
            {renderHeader()}
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
