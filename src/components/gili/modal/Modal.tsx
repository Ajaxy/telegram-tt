import type { TeactNode } from '../../../lib/teact/teact';
import {
  createContext,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import { waitForAnimationEnd } from '../../../util/cssAnimationEndListeners';

import useContext from '../../../hooks/data/useContext';
import useFrozenProps from '../../../hooks/useFrozenProps';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useUniqueId from '../../../hooks/useUniqueId';

import Button from '../../ui/Button';
import Portal from '../../ui/Portal';
import Surface from '../layout/Surface';

import styles from './Modal.module.scss';

const CLOSE_ANIMATION_DURATION = 200;

let openModalCount = 0;

export type ModalWidth = 'slim' | 'regular' | 'wide' | 'fullscreen';
export type ModalHeight = 'auto' | 'regular' | 'tall' | 'fullscreen';

export type ModalProps = {
  isOpen: boolean;
  children: TeactNode;
  header?: TeactNode;
  dialogClassName?: string;
  contentClassName?: string;
  width?: ModalWidth;
  height?: ModalHeight;
  noBackdrop?: boolean;
  noLightDismiss?: boolean;
  ariaLabel?: string;
  noContainment?: boolean;
  onClose: NoneToVoidFunction;
};

type ModalContextType = {
  titleId: string;
  subtitleId: string;
  hasSubtitle: boolean;
  onClose: NoneToVoidFunction;
  registerTitle: (isPresent: boolean) => void;
  registerSubtitle: (isPresent: boolean) => void;
};

type ModalSlotProps = {
  className?: string;
  children?: TeactNode;
};

type ModalCloseButtonProps = {
  asAbsolute?: boolean;
  className?: string;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

const WIDTH_CLASS_NAME: Record<ModalWidth, string> = {
  slim: styles.widthSlim,
  regular: styles.widthRegular,
  wide: styles.widthWide,
  fullscreen: styles.widthFullscreen,
};

const HEIGHT_CLASS_NAME: Record<ModalHeight, string> = {
  auto: styles.heightAuto,
  regular: styles.heightRegular,
  tall: styles.heightTall,
  fullscreen: styles.heightFullscreen,
};

function useModalContext() {
  return useContext(ModalContext);
}

function addBodyDialogClass() {
  openModalCount += 1;
  requestMutation(() => {
    document.body.classList.add('has-open-dialog');
  });

  return () => {
    openModalCount = Math.max(0, openModalCount - 1);

    if (!openModalCount) {
      requestMutation(() => {
        document.body.classList.remove('has-open-dialog');
      });
    }
  };
}

const Modal = ({
  isOpen,
  children,
  header,
  dialogClassName,
  contentClassName,
  width = 'regular',
  height = 'regular',
  noBackdrop,
  noLightDismiss,
  ariaLabel,
  noContainment,
  onClose,
}: ModalProps) => {
  const [shouldRender, setShouldRender] = useState(Boolean(isOpen));
  const [isClosing, setIsClosing] = useState(false);
  const [hasTitle, setHasTitle] = useState(false);
  const [hasSubtitle, setHasSubtitle] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>();
  const panelRef = useRef<HTMLDivElement>();
  const closeAnimationCleanupRef = useRef<NoneToVoidFunction>();

  const uniqueId = useUniqueId();
  const titleId = `modal-title-${uniqueId}`;
  const subtitleId = `modal-subtitle-${uniqueId}`;

  const frozenProps = useFrozenProps({
    header,
    children,
    dialogClassName,
    contentClassName,
    width,
    height,
    noBackdrop,
    ariaLabel,
    noContainment,
  }, !isOpen);

  const shouldShowHeader = Boolean(frozenProps.header);

  const cleanupCloseAnimation = useLastCallback(() => {
    closeAnimationCleanupRef.current?.();
    closeAnimationCleanupRef.current = undefined;
  });

  const finishClose = useLastCallback(() => {
    cleanupCloseAnimation();

    const dialogElement = dialogRef.current;

    if (dialogElement?.open) {
      dialogElement.close();
    }

    setIsClosing(false);
    setShouldRender(false);
  });

  const handleRequestClose = useLastCallback(() => {
    if (isClosing) return;

    onClose();
  });

  const registerTitle = useLastCallback((isPresent: boolean) => {
    setHasTitle(isPresent);
  });

  const registerSubtitle = useLastCallback((isPresent: boolean) => {
    setHasSubtitle(isPresent);
  });

  const contextValue = useMemo<ModalContextType>(() => ({
    onClose: handleRequestClose,
    titleId,
    subtitleId,
    hasSubtitle,
    registerTitle,
    registerSubtitle,
  }), [
    handleRequestClose,
    hasSubtitle,
    registerSubtitle,
    registerTitle,
    subtitleId,
    titleId,
  ]);

  useEffect(() => {
    if (isOpen) {
      cleanupCloseAnimation();

      if (!shouldRender) {
        setShouldRender(true);
        return;
      }

      if (isClosing) {
        setIsClosing(false);
      }

      return;
    }

    if (!shouldRender || isClosing) {
      return;
    }

    setIsClosing(true);
  }, [isClosing, isOpen, shouldRender]);

  useEffect(() => {
    if (!isClosing) {
      cleanupCloseAnimation();
      return undefined;
    }

    const panelElement = panelRef.current;

    if (!panelElement) {
      finishClose();
      return undefined;
    }

    if (document.body.classList.contains('no-page-transitions')) {
      finishClose();
      return undefined;
    }

    closeAnimationCleanupRef.current = waitForAnimationEnd(
      panelElement,
      finishClose,
      undefined,
      CLOSE_ANIMATION_DURATION + 100,
    );

    return cleanupCloseAnimation;
  }, [isClosing]);

  useLayoutEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const dialogElement = dialogRef.current;

    if (!dialogElement) {
      return undefined;
    }

    if (!dialogElement.open) {
      dialogElement.showModal();
    }

    return () => {
      cleanupCloseAnimation();

      if (dialogElement.open) {
        dialogElement.close();
      }
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    return addBodyDialogClass();
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const dialogElement = dialogRef.current;

    if (!dialogElement) {
      return undefined;
    }

    const handleCancel = (event: Event) => {
      event.preventDefault();

      if (noLightDismiss || !isOpen || isClosing) {
        return;
      }

      handleRequestClose();
    };

    dialogElement.addEventListener('cancel', handleCancel);

    return () => {
      dialogElement.removeEventListener('cancel', handleCancel);
    };
  }, [isClosing, isOpen, noLightDismiss, shouldRender]);

  useHistoryBack({
    isActive: Boolean(isOpen && !noLightDismiss),
    onBack: handleRequestClose,
  });

  const handleDialogClick = useLastCallback((event: React.MouseEvent<HTMLDialogElement>) => {
    if (
      event.target !== event.currentTarget
      || noLightDismiss
      || !isOpen
      || isClosing
    ) {
      return;
    }

    handleRequestClose();
  });

  if (!shouldRender) {
    return undefined;
  }

  return (
    <Portal>
      <ModalContext.Provider value={contextValue}>
        <dialog
          ref={dialogRef}
          className={buildClassName(
            styles.dialog,
            WIDTH_CLASS_NAME[frozenProps.width],
            HEIGHT_CLASS_NAME[frozenProps.height],
            frozenProps.noBackdrop && styles.noBackdrop,
            (frozenProps.width === 'fullscreen' || frozenProps.height === 'fullscreen') && styles.fullscreen,
            isClosing ? styles.closing : styles.open,
            frozenProps.dialogClassName,
            !frozenProps.noContainment && styles.contained,
          )}
          aria-modal="true"
          aria-label={!hasTitle ? frozenProps.ariaLabel : undefined}
          aria-labelledby={hasTitle ? titleId : undefined}
          aria-describedby={hasSubtitle ? subtitleId : undefined}
          onClick={handleDialogClick}
        >
          <div ref={panelRef} className={styles.panel}>
            {shouldShowHeader && (
              <div className={styles.headerSlot}>
                {frozenProps.header}
              </div>
            )}

            <Surface
              scrollable
              className={buildClassName(
                styles.content,
                shouldShowHeader && styles.withHeader,
                frozenProps.contentClassName,
              )}
            >
              <div className={styles.body}>
                {frozenProps.children}
              </div>
            </Surface>
          </div>
        </dialog>
      </ModalContext.Provider>
    </Portal>
  );
};

const ModalHeader = ({ className, children }: ModalSlotProps) => {
  const modalContext = useModalContext();

  return (
    <div
      className={buildClassName(
        styles.header,
        modalContext?.hasSubtitle && styles.headerWithSubtitle,
        className,
      )}
    >
      {children}
    </div>
  );
};

const ModalHeaderAction = ({ className, children }: ModalSlotProps) => {
  return (
    <div className={buildClassName(styles.headerAction, className)}>
      {children}
    </div>
  );
};

const ModalTitle = ({ className, children }: ModalSlotProps) => {
  const modalContext = useModalContext();

  useLayoutEffect(() => {
    modalContext?.registerTitle(true);

    return () => {
      modalContext?.registerTitle(false);
    };
  }, [modalContext]);

  return (
    <div
      id={modalContext?.titleId}
      className={buildClassName(styles.title, className)}
      dir="auto"
    >
      {children}
    </div>
  );
};

const ModalSubtitle = ({ className, children }: ModalSlotProps) => {
  const modalContext = useModalContext();

  useLayoutEffect(() => {
    modalContext?.registerSubtitle(true);

    return () => {
      modalContext?.registerSubtitle(false);
    };
  }, [modalContext]);

  return (
    <div
      id={modalContext?.subtitleId}
      className={buildClassName(styles.subtitle, className)}
      dir="auto"
    >
      {children}
    </div>
  );
};

const ModalCloseButton = ({ asAbsolute, className }: ModalCloseButtonProps) => {
  const lang = useLang();
  const modalContext = useModalContext();

  const handleClick = useLastCallback(() => {
    modalContext?.onClose();
  });

  return (
    <Button
      round
      color="translucent"
      size="tiny"
      ariaLabel={lang('Close')}
      className={buildClassName(
        styles.closeButton,
        asAbsolute && styles.closeButtonAbsolute,
        className,
      )}
      onClick={handleClick}
    >
      <div className="animated-close-icon" />
    </Button>
  );
};

export default memo(Modal);
export {
  ModalHeader,
  ModalHeaderAction,
  ModalTitle,
  ModalSubtitle,
  ModalCloseButton,
};
