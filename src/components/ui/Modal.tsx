import React, {
  FC, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { HistoryWrapper } from '../../util/history';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import trapFocus from '../../util/trapFocus';
import buildClassName from '../../util/buildClassName';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useShowTransition from '../../hooks/useShowTransition';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';
import useOnChange from '../../hooks/useOnChange';

import Button from './Button';
import Portal from './Portal';

import './Modal.scss';

const ANIMATION_DURATION = 200;

type OwnProps = {
  title?: string;
  className?: string;
  isOpen?: boolean;
  header?: FC;
  hasCloseButton?: boolean;
  noBackdrop?: boolean;
  children: any;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  onEnter?: () => void;
};

const Modal: FC<OwnProps> = (props) => {
  const {
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
  } = props;
  const [isClosedWithHistory, setIsClosedWithHistory] = useState(false);
  const [noAnimations, setNoAnimations] = useState(false);
  const [isFirstRender, setIsFirstRender] = useState(true);
  const {
    shouldRender,
    transitionClassNames,
  } = useShowTransition(isOpen, onCloseAnimationEnd, noAnimations, undefined, noAnimations);
  // eslint-disable-next-line no-null/no-null
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => (isOpen
    ? captureKeyboardListeners({ onEsc: onClose, onEnter })
    : undefined), [isOpen, onClose, onEnter]);
  useEffect(() => (isOpen && modalRef.current ? trapFocus(modalRef.current) : undefined), [isOpen]);

  useHistoryBack((event, noAnimation, previousHistoryState) => {
    if (previousHistoryState && previousHistoryState.type === 'modal') {
      setIsClosedWithHistory(true);
      if (noAnimation) {
        setNoAnimations(true);
        setTimeout(() => setNoAnimations(false), ANIMATION_DURATION);
      }
      onClose();
    }
  });

  useOnChange(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }
    if (isOpen) {
      HistoryWrapper.pushState({
        type: 'modal',
      });
    } else if (!isClosedWithHistory) {
      HistoryWrapper.back();
    } else {
      setIsClosedWithHistory(false);
    }
  }, [isOpen]);

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
          <div className="modal-dialog">
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
