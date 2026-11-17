import type { ElementRef, TeactNode } from '../../../lib/teact/teact';
import {
  createContext,
  memo,
  requestAfterRender,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { IS_DOCUMENT_PICTURE_IN_PICTURE_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import { waitForAnimationEnd } from '../../../util/cssAnimationEndListeners';
import Deferred from '../../../util/Deferred';
import { disableDirectTextInput, enableDirectTextInput } from '../../../util/directInputManager';
import { countOpenModal } from '../../../util/openModals';
import animateToPictureInPicture from './animateToPictureInPicture';

import useContext from '../../../hooks/data/useContext';
import useDocumentPictureInPicture from '../../../hooks/useDocumentPictureInPicture';
import useFrozenProps from '../../../hooks/useFrozenProps';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useUniqueId from '../../../hooks/useUniqueId';
import useWindow from '../../../hooks/useWindow';

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
  noScrollable?: boolean;
  noContentInlinePadding?: boolean;
  keepMounted?: boolean;
  stickyFooter?: TeactNode;
  ariaLabel?: string;
  noContainment?: boolean;
  pictureInPictureId?: string;
  pictureInPictureOptions?: DocumentPictureInPictureOptions;
  noHeaderInPictureInPicture?: boolean;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
  onEsc?: NoneToVoidFunction;
  // Runs once the content is shown in its current document
  onAdopt?: NoneToVoidFunction;
};

type ModalContextType = {
  titleId: string;
  subtitleId: string;
  hasSubtitle: boolean;
  isPictureInPicture: boolean;
  requestPictureInPicture: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  registerTitle: (isPresent: boolean) => void;
  registerSubtitle: (isPresent: boolean) => void;
};

type ModalSlotProps = {
  className?: string;
  children?: TeactNode;
};

type ModalHeaderProps = {
  ref?: ElementRef<HTMLDivElement>;
  noMask?: boolean;
} & ModalSlotProps;

type ModalFooterActionsProps = {
  isVertical?: boolean;
} & ModalSlotProps;

type ModalTitleProps = {
  noAutoFocus?: boolean;
} & ModalSlotProps;

type ModalCloseButtonProps = {
  asAbsolute?: boolean;
  className?: string;
  // Turns the cross into a back arrow
  onBack?: NoneToVoidFunction;
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

export function useModalContext() {
  return useContext(ModalContext);
}

function addBodyDialogClass() {
  openModalCount += 1;

  const stopCounting = countOpenModal();

  requestMutation(() => {
    document.body.classList.add('has-open-dialog');
  });

  return () => {
    openModalCount = Math.max(0, openModalCount - 1);
    stopCounting();

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
  noScrollable,
  noContentInlinePadding,
  keepMounted,
  stickyFooter,
  ariaLabel,
  noContainment,
  pictureInPictureId,
  pictureInPictureOptions,
  noHeaderInPictureInPicture,
  onClose,
  onCloseAnimationEnd,
  onEsc,
  onAdopt,
}: ModalProps) => {
  const lang = useLang();
  const [hasEverOpened, setHasEverOpened] = useState(Boolean(isOpen));
  const [shouldRender, setShouldRender] = useState(Boolean(isOpen));
  const [isClosing, setIsClosing] = useState(false);
  const [hasTitle, setHasTitle] = useState(false);
  const [hasSubtitle, setHasSubtitle] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>();
  const panelRef = useRef<HTMLDivElement>();
  const closeAnimationCleanupRef = useRef<NoneToVoidFunction>();
  // A press that starts or ends on the panel, such as a drag, gets its click on the dialog itself, as the closest element
  // common to both ends, so the click alone looks like one on the backdrop. Both ends are caught in the capture phase,
  // before the panel content can stop them.
  const isPressOutsideRef = useRef(false);
  const hasFinishedCloseRef = useRef(!isOpen);
  const pictureInPictureAdoptionRef = useRef<Deferred<void>>();

  const uniqueId = useUniqueId();
  const renderingWindow = useWindow();
  const { pictureInPictureWindow, requestPictureInPicture, closePictureInPicture } = useDocumentPictureInPicture(
    pictureInPictureId || uniqueId, pictureInPictureOptions,
  );
  const [readyPictureInPictureWindow, setReadyPictureInPictureWindow] = useState<Window>();
  const renderingPictureInPictureWindow = pictureInPictureWindow === readyPictureInPictureWindow
    ? pictureInPictureWindow : undefined;
  const isPictureInPicture = Boolean(renderingPictureInPictureWindow);
  const wasPictureInPictureRef = useRef(false);
  const targetDocument = (renderingPictureInPictureWindow || renderingWindow).document;
  const isInMainDocument = targetDocument === document;
  const titleId = `modal-title-${uniqueId}`;
  const subtitleId = `modal-subtitle-${uniqueId}`;

  const frozenProps = useFrozenProps({
    header,
    children,
    stickyFooter,
    dialogClassName,
    contentClassName,
    width,
    height,
    noBackdrop,
    noScrollable,
    noContentInlinePadding,
    ariaLabel,
    noContainment,
  }, !isOpen);

  const shouldShowHeader = Boolean(frozenProps.header) && !(isPictureInPicture && noHeaderInPictureInPicture);

  const cleanupCloseAnimation = useLastCallback(() => {
    closeAnimationCleanupRef.current?.();
    closeAnimationCleanupRef.current = undefined;
  });

  const finishClose = useLastCallback(() => {
    if (hasFinishedCloseRef.current) return;
    hasFinishedCloseRef.current = true;
    cleanupCloseAnimation();
    setIsClosing(false);
    setShouldRender(false);
    onCloseAnimationEnd?.();
  });

  const handleRequestClose = useLastCallback(() => {
    if (isClosing) return;

    if (isPictureInPicture) {
      closePictureInPicture();
    }
    onClose();
  });

  const handleEsc = useLastCallback((event: Event, isCloseRequest?: boolean) => {
    if (dialogRef.current?.querySelector('.Menu .backdrop')) {
      event.preventDefault();
      return false;
    }
    if (isPictureInPicture) {
      event.preventDefault();
      closePictureInPicture();
      return undefined;
    }
    if (noLightDismiss || !isOpen || isClosing) return undefined;

    event.preventDefault();

    // Native close requests (e.g. Android back) close the modal like history back does
    if (onEsc && !isCloseRequest) {
      onEsc();
      return undefined;
    }

    handleRequestClose();
    return undefined;
  });

  const registerTitle = useLastCallback((isPresent: boolean) => {
    setHasTitle(isPresent);
  });

  const registerSubtitle = useLastCallback((isPresent: boolean) => {
    setHasSubtitle(isPresent);
  });

  const showDialog = useLastCallback(() => {
    const dialogElement = dialogRef.current;
    if (!isOpen || !dialogElement?.isConnected || dialogElement.ownerDocument !== targetDocument) return;
    if (isPictureInPicture ? dialogElement.open : dialogElement.matches(':modal')) return;
    if (dialogElement.open) dialogElement.close();
    if (isPictureInPicture) {
      dialogElement.show();
    } else {
      dialogElement.showModal();
    }
  });

  const handleAdopt = useLastCallback(() => {
    // Context consumers render their autofocus attributes before the native dialog opens
    requestAfterRender(() => {
      showDialog();
      if (dialogRef.current?.ownerDocument === pictureInPictureWindow?.document) {
        pictureInPictureAdoptionRef.current?.resolve();
        pictureInPictureAdoptionRef.current = undefined;
      }
      onAdopt?.();
    });
  });

  const contextValue = useMemo<ModalContextType>(() => ({
    onClose: handleRequestClose,
    titleId,
    subtitleId,
    hasSubtitle,
    isPictureInPicture,
    requestPictureInPicture,
    registerTitle,
    registerSubtitle,
  }), [
    handleRequestClose,
    hasSubtitle,
    isPictureInPicture,
    requestPictureInPicture,
    registerSubtitle,
    registerTitle,
    subtitleId,
    titleId,
  ]);

  useEffect(() => {
    if (isOpen && !hasEverOpened) {
      setHasEverOpened(true);
    }
  }, [hasEverOpened, isOpen]);

  useLayoutEffect(() => {
    if (isOpen) hasFinishedCloseRef.current = false;
    if (!pictureInPictureWindow) setReadyPictureInPictureWindow(undefined);
    if (!isOpen) {
      closePictureInPicture();
      if (wasPictureInPictureRef.current) finishClose();
    }
    wasPictureInPictureRef.current = isOpen && isPictureInPicture;
  }, [isOpen, isPictureInPicture, pictureInPictureWindow, closePictureInPicture]);

  useEffect(() => {
    if (!isOpen || !pictureInPictureWindow) return undefined;

    const cancelAnimation = animateToPictureInPicture(panelRef.current!, pictureInPictureWindow, () => {
      const adopted = new Deferred<void>();
      pictureInPictureAdoptionRef.current = adopted;
      setReadyPictureInPictureWindow(pictureInPictureWindow);
      return adopted.promise;
    });

    return () => {
      cancelAnimation();
      pictureInPictureAdoptionRef.current?.resolve();
      pictureInPictureAdoptionRef.current = undefined;
    };
  }, [isOpen, pictureInPictureWindow]);

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

    if (!shouldRender || isClosing || hasFinishedCloseRef.current) {
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

    let isCanceled = false;
    const releaseAnimation = waitForAnimationEnd(
      panelElement,
      () => {
        if (!isCanceled) finishClose();
      },
      undefined,
      CLOSE_ANIMATION_DURATION + 100,
    );
    closeAnimationCleanupRef.current = () => {
      isCanceled = true;
      releaseAnimation();
    };

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

    handleAdopt();

    return () => {
      cleanupCloseAnimation();

      if (dialogElement.open) {
        dialogElement.close();
      }
    };
  }, [shouldRender, targetDocument, handleAdopt]);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    return captureKeyboardListeners({ onEsc: handleEsc }, targetDocument);
  }, [handleEsc, shouldRender, targetDocument]);

  useEffect(() => {
    if (!shouldRender || !isInMainDocument) {
      return undefined;
    }

    return addBodyDialogClass();
  }, [shouldRender, isInMainDocument]);

  useEffect(() => {
    if (!shouldRender || !isInMainDocument) {
      return undefined;
    }

    disableDirectTextInput();

    return enableDirectTextInput;
  }, [shouldRender, isInMainDocument]);

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

      handleEsc(event, true);
    };

    dialogElement.addEventListener('cancel', handleCancel);

    return () => {
      dialogElement.removeEventListener('cancel', handleCancel);
    };
  }, [handleEsc, shouldRender]);

  useHistoryBack({
    isActive: Boolean(isOpen && !noLightDismiss && isInMainDocument),
    onBack: handleRequestClose,
  });

  const handleDialogPointerDown = useLastCallback((event: React.PointerEvent<HTMLDialogElement>) => {
    isPressOutsideRef.current = event.target === event.currentTarget;
  });

  const handleDialogPointerUp = useLastCallback((event: React.PointerEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) isPressOutsideRef.current = false;
  });

  const handleDialogClick = useLastCallback((event: React.MouseEvent<HTMLDialogElement>) => {
    if (
      event.target !== event.currentTarget
      || !isPressOutsideRef.current
      || noLightDismiss
      || !isOpen
      || isClosing
    ) {
      return;
    }

    // Opening a portalled menu on mouse-down can retarget the trigger's click to the dialog
    const { left, right, top, bottom } = panelRef.current!.getBoundingClientRect();
    if (event.clientX >= left && event.clientX <= right && event.clientY >= top && event.clientY <= bottom) return;

    handleRequestClose();
  });

  if (!shouldRender && !(keepMounted && hasEverOpened)) {
    return undefined;
  }

  return (
    <Portal
      pictureInPictureWindow={renderingPictureInPictureWindow}
      nestedContainerRef={dialogRef}
      onAdopt={handleAdopt}
    >
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
            isPictureInPicture && styles.pictureInPicture,
          )}
          aria-modal={isPictureInPicture ? undefined : 'true'}
          aria-label={!hasTitle ? frozenProps.ariaLabel : undefined}
          aria-labelledby={hasTitle ? titleId : undefined}
          aria-describedby={hasSubtitle ? subtitleId : undefined}
          onPointerDownCapture={handleDialogPointerDown}
          onPointerUpCapture={handleDialogPointerUp}
          onClick={handleDialogClick}
        >
          <div ref={panelRef} className={styles.panel}>
            {Boolean(frozenProps.header) && (
              <div className={styles.headerSlot} hidden={!shouldShowHeader}>
                {frozenProps.header}
              </div>
            )}

            <Surface
              scrollable={!frozenProps.noScrollable}
              noPadding={frozenProps.noContentInlinePadding}
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
            {Boolean(frozenProps.stickyFooter) && (
              <div className={styles.stickyFooter}>
                {frozenProps.stickyFooter}
              </div>
            )}
          </div>
          {isPictureInPicture && (
            <div className={styles.resizeHint} role="status">
              {lang('PictureInPictureResizeHint')}
            </div>
          )}
        </dialog>
      </ModalContext.Provider>
    </Portal>
  );
};

const ModalHeader = ({
  ref, noMask, className, children,
}: ModalHeaderProps) => {
  const modalContext = useModalContext();

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.header,
        modalContext?.hasSubtitle && styles.headerWithSubtitle,
        !noMask && styles.scrollMask,
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

const ModalFooterActions = ({ isVertical, className, children }: ModalFooterActionsProps) => {
  return (
    <div
      className={buildClassName(
        styles.footerActions,
        isVertical && styles.footerActionsVertical,
        className,
      )}
    >
      {children}
    </div>
  );
};

const ModalTitle = ({ noAutoFocus, className, children }: ModalTitleProps) => {
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
      tabIndex={-1}
      autoFocus={!noAutoFocus && !modalContext?.isPictureInPicture}
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

const ModalCloseButton = ({ asAbsolute, className, onBack }: ModalCloseButtonProps) => {
  const lang = useLang();
  const modalContext = useModalContext();

  const handleClick = useLastCallback(() => {
    if (onBack) {
      onBack();
      return;
    }

    modalContext?.onClose();
  });

  return (
    <Button
      round
      color="translucent"
      size="tiny"
      ariaLabel={onBack ? lang('Back') : lang('Close')}
      className={buildClassName(
        styles.closeButton,
        asAbsolute && styles.closeButtonAbsolute,
        className,
      )}
      onClick={handleClick}
    >
      <div className={buildClassName('animated-close-icon', onBack && 'state-back')} />
    </Button>
  );
};

const ModalPictureInPictureButton = () => {
  const lang = useLang();
  const modalContext = useModalContext();

  if (!IS_DOCUMENT_PICTURE_IN_PICTURE_SUPPORTED || !modalContext || modalContext.isPictureInPicture) {
    return undefined;
  }

  return (
    <Button
      round
      color="translucent"
      size="tiny"
      iconName="pip"
      ariaLabel={lang('VideoPlayerPictureInPicture')}
      onClick={modalContext.requestPictureInPicture}
    />
  );
};

export default memo(Modal);
export {
  ModalHeader,
  ModalHeaderAction,
  ModalFooterActions,
  ModalTitle,
  ModalSubtitle,
  ModalCloseButton,
  ModalPictureInPictureButton,
};
