/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useRef } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import freezeWhenClosed from '../../util/hoc/freezeWhenClosed.react';
import trapFocus from '../../util/trapFocus';

import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck.react';
import useHistoryBack from '../../hooks/useHistoryBack.react';
import useLang from '../../hooks/useLang.react';
import useLastCallback from '../../hooks/useLastCallback.react';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps.react';
import useShowTransition from '../../hooks/useShowTransition.react';

import Button from './Button.react';
import Portal from './Portal.react';

import './Modal.scss';

const ANIMATION_DURATION = 200;

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
  style?: object;
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
          <div
            className={buildClassName('modal-content custom-scroll', contentClassName)}
            // @ts-ignore
            style={style}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const ModalInPortal: FC<OwnProps & StateProps> = (props) => (
  <Portal containerId="#chat-folders-tree-modals-root">
    <Modal {...props} />
  </Portal>
);

export default freezeWhenClosed(ModalInPortal);
