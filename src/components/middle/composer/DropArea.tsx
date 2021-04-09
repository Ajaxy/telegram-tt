import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import useShowTransition from '../../../hooks/useShowTransition';
import buildClassName from '../../../util/buildClassName';

import captureEscKeyListener from '../../../util/captureEscKeyListener';
import usePrevious from '../../../hooks/usePrevious';

import DropTarget from './DropTarget';

import './DropArea.scss';

export type OwnProps = {
  isOpen: boolean;
  withQuick?: boolean;
  onHide: NoneToVoidFunction;
  onFileSelect: (files: File[], isQuick: boolean) => void;
};

export enum DropAreaState {
  None = 'none',
  Document = 'document',
  QuickFile = 'quick_file',
}

const DROP_LEAVE_TIMEOUT_MS = 150;

const DropArea: FC<OwnProps> = ({
  isOpen, withQuick, onHide, onFileSelect,
}) => {
  // eslint-disable-next-line no-null/no-null
  const hideTimeoutRef = useRef<number>(null);
  const prevWithQuick = usePrevious(withQuick);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen);

  useEffect(() => (isOpen ? captureEscKeyListener(onHide) : undefined), [isOpen, onHide]);

  const handleFilesDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const { dataTransfer: dt } = e;

    if (dt.files && dt.files.length > 0) {
      onHide();
      onFileSelect(Array.from(dt.files), false);
    }
  }, [onFileSelect, onHide]);

  const handleQuickFilesDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const { dataTransfer: dt } = e;

    if (dt.files && dt.files.length > 0) {
      onHide();
      onFileSelect(Array.from(dt.files), true);
    }
  }, [onFileSelect, onHide]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();

    const { target: fromTarget, relatedTarget: toTarget } = e;

    // Esc button pressed during drag event
    if ((fromTarget as HTMLDivElement).matches('.DropTarget, .DropArea') && !toTarget) {
      hideTimeoutRef.current = window.setTimeout(() => {
        onHide();
      }, DROP_LEAVE_TIMEOUT_MS);
    }
  }, [onHide]);

  const handleDragOver = () => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
    }
  };

  if (!shouldRender) {
    return undefined;
  }

  const className = buildClassName(
    'DropArea',
    transitionClassNames,
  );

  return (
    <div className={className} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={onHide}>
      <DropTarget onFileSelect={handleFilesDrop} />
      {(withQuick || prevWithQuick) && <DropTarget onFileSelect={handleQuickFilesDrop} isQuick />}
    </div>
  );
};

export default memo(DropArea);
