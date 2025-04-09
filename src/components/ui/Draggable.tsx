import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';

import styles from './Draggable.module.scss';

type TPoint = {
  x: number;
  y: number;
};

type DraggableState = {
  isDragging: boolean;
  origin: TPoint;
  translation: TPoint;
  width?: number;
  height?: number;
};

type OwnProps = {
  children: React.ReactNode;
  onDrag: (translation: TPoint, id: number | string) => void;
  onDragEnd: NoneToVoidFunction;
  id: number | string;
  style?: string;
  knobStyle?: string;
  isDisabled?: boolean;
};

const ZERO_POINT: TPoint = { x: 0, y: 0 };

const Draggable: FC<OwnProps> = ({
  children,
  id,
  onDrag,
  onDragEnd,
  style: externalStyle,
  knobStyle,
  isDisabled,
}) => {
  const lang = useOldLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<DraggableState>({
    isDragging: false,
    origin: ZERO_POINT,
    translation: ZERO_POINT,
  });

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const { x, y } = getClientCoordinate(e);

    setState({
      ...state,
      isDragging: true,
      origin: { x, y },
      width: ref.current?.offsetWidth,
      height: ref.current?.offsetHeight,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    const { x, y } = getClientCoordinate(e);

    const translation = {
      x: x - state.origin.x,
      y: y - state.origin.y,
    };

    setState((current) => ({
      ...current,
      translation,
    }));

    onDrag(translation, id);
  }, [id, onDrag, state.origin.x, state.origin.y]);

  const handleMouseUp = useCallback(() => {
    setState((current) => ({
      ...current,
      isDragging: false,
      width: undefined,
      height: undefined,
    }));

    onDragEnd();
  }, [onDragEnd]);

  useEffect(() => {
    if (state.isDragging && isDisabled) {
      setState((current) => ({
        ...current,
        isDragging: false,
        width: undefined,
        height: undefined,
      }));
    }
  }, [isDisabled, state.isDragging]);

  useEffect(() => {
    if (state.isDragging) {
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
      window.addEventListener('touchcancel', handleMouseUp);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchcancel', handleMouseUp);
      window.removeEventListener('mouseup', handleMouseUp);

      setState((current) => ({
        ...current,
        translation: ZERO_POINT,
      }));
    }

    return () => {
      if (state.isDragging) {
        window.removeEventListener('touchmove', handleMouseMove);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchend', handleMouseUp);
        window.removeEventListener('touchcancel', handleMouseUp);
        window.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [handleMouseMove, handleMouseUp, state.isDragging]);

  const fullClassName = buildClassName(styles.container, state.isDragging && styles.isDragging);

  const cssStyles = useMemo(() => {
    return buildStyle(
      state.isDragging && `transform: translate(${state.translation.x}px, ${state.translation.y}px)`,
      state.width ? `width: ${state.width}px` : undefined,
      state.height ? `height: ${state.height}px` : undefined,
      externalStyle,
    );
  }, [externalStyle, state.height, state.isDragging, state.translation.x, state.translation.y, state.width]);

  return (
    <div style={cssStyles} className={fullClassName} ref={ref}>
      {children}

      {!isDisabled && (
        <div
          aria-label={lang('i18n_dragToSort')}
          tabIndex={0}
          role="button"
          className={buildClassName(styles.knob, 'div-button', 'draggable-knob')}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          style={knobStyle}
        >
          <Icon name="sort" className={styles.icon} />
        </div>
      )}
    </div>
  );
};

export default memo(Draggable);

function getClientCoordinate(e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) {
  let x;
  let y;

  if ('touches' in e) {
    x = e.touches[0].clientX;
    y = e.touches[0].clientY;
  } else {
    x = e.clientX;
    y = e.clientY;
  }

  return { x, y };
}
