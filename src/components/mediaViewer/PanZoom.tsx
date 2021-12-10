/*
  @source https://github.com/ajainarayanan/react-pan-zoom

  Heavily inspired/lifted from this idea: https://stackoverflow.com/a/39311435/661768
  without jqueryUI or jquery dependency.
*/
import React, {
  FC, memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { areSortedArraysEqual } from '../../util/iteratees';

import './PanZoom.scss';

export interface IDragData {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface OwnProps {
  children: any;
  className?: string;
  noWrap: boolean;
  canPan: boolean;
  zoomLevel: number;
  panDeltaX: number;
  panDeltaY: number;
  onPan?: (x: number, y: number) => void;
}

const INITIAL_MATRIX = [
  1, 0, 0, 1, 0, 0,
];

const SCALE_VALUES = {
  1: 1,
  1.5: 1.5,
  2: 2.2,
  2.5: 3.3,
  3: 5.5,
};

const ZOOM_SAFE_AREA = 150;

function calculateSafeZoneOnZoom(oldScale: number, matrixData: number[], wrapper: HTMLDivElement | null) {
  const image = wrapper && wrapper.querySelector('.Transition__slide--active img');
  if (!wrapper || !image) {
    return matrixData;
  }
  const wrapperRect = wrapper.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();

  const newImgWidth = (imageRect.width / oldScale) * matrixData[0];
  const newImgHeight = (imageRect.height / oldScale) * matrixData[3];
  const newImgX = (wrapperRect.width - newImgWidth) / 2 + matrixData[4];
  const newImgY = (wrapperRect.height - newImgHeight) / 2 + matrixData[5];
  if (wrapperRect.width && wrapperRect.width - ZOOM_SAFE_AREA < newImgX) {
    matrixData[4] -= newImgX + wrapperRect.width - ZOOM_SAFE_AREA;
  } else if (newImgWidth && newImgWidth + newImgX < ZOOM_SAFE_AREA) {
    matrixData[4] -= newImgWidth + newImgX - ZOOM_SAFE_AREA;
  }
  if (wrapperRect.height && wrapperRect.height - ZOOM_SAFE_AREA < newImgY) {
    matrixData[5] -= newImgY + wrapperRect.height - ZOOM_SAFE_AREA;
  } else if (newImgHeight && newImgHeight + newImgY < ZOOM_SAFE_AREA) {
    matrixData[5] -= newImgHeight + newImgY - ZOOM_SAFE_AREA;
  }

  return matrixData;
}

const PanZoom: FC<OwnProps> = ({
  children,
  className,
  noWrap,
  canPan,
  zoomLevel,
  panDeltaX,
  panDeltaY,
  onPan,
}) => {
  const tunedZoomLevel = SCALE_VALUES[zoomLevel as keyof typeof SCALE_VALUES] || zoomLevel;
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragData, setDragData] = useState<IDragData>({
    dx: panDeltaX, dy: panDeltaY, x: 0, y: 0,
  });
  // [zoom, skew, skew, zoom, dx, dy] - see https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix()
  const [matrixData, setMatrixData] = useState<number[]>(INITIAL_MATRIX);
  // Used to set cursor while moving.
  // eslint-disable-next-line no-null/no-null
  const panWrapperRef = useRef<HTMLDivElement>(null);
  // Used to set transform for pan.
  // eslint-disable-next-line no-null/no-null
  const panContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newZoomLevel = tunedZoomLevel || matrixData[0];
    const newPandx = panDeltaX || matrixData[4];
    const newPandy = panDeltaY || matrixData[5];

    const newMatrixData = [...matrixData];
    if (matrixData[0] !== newZoomLevel) {
      newMatrixData[0] = newZoomLevel || newMatrixData[0];
      newMatrixData[3] = newZoomLevel || newMatrixData[3];
    }
    if (matrixData[4] !== newPandx) {
      newMatrixData[4] = newPandx;
    }
    if (matrixData[5] !== newPandy) {
      newMatrixData[5] = newPandy;
    }

    if (!areSortedArraysEqual(matrixData, newMatrixData)) {
      setMatrixData(calculateSafeZoneOnZoom(matrixData[0], newMatrixData, panWrapperRef.current));
    }
    // eslint-disable-next-line
  }, [panDeltaX, panDeltaY, tunedZoomLevel]);

  useEffect(() => {
    if (!canPan) {
      setMatrixData(INITIAL_MATRIX);
    }
  }, [canPan]);

  useEffect(() => {
    if (panContainerRef.current) {
      panContainerRef.current.style.transform = `matrix(${matrixData.toString()})`;
    }
  }, [noWrap, matrixData]);

  const handleMouseDown = (e: React.MouseEvent<EventTarget>) => {
    if (!canPan) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const offsetX = matrixData[4];
    const offsetY = matrixData[5];
    const newDragData: IDragData = {
      dx: offsetX,
      dy: offsetY,
      x: e.pageX,
      y: e.pageY,
    };
    setDragData(newDragData);
    setIsDragging(true);

    if (panWrapperRef.current) {
      panWrapperRef.current.classList.add('move');
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);

    if (panWrapperRef.current) {
      panWrapperRef.current.classList.remove('move');
    }

    if (onPan) {
      onPan(matrixData[4], matrixData[5]);
    }
  };

  function getNewMatrixData(x: number, y: number): number[] {
    const newMatrixData = [...matrixData];
    const deltaX = dragData.x - x;
    const deltaY = dragData.y - y;
    newMatrixData[4] = dragData.dx - deltaX;
    newMatrixData[5] = dragData.dy - deltaY;

    return newMatrixData;
  }

  const handleMouseMove = (e: React.MouseEvent<EventTarget>) => {
    if (isDragging) {
      const newMatrixData = getNewMatrixData(e.pageX, e.pageY);
      setMatrixData(newMatrixData);

      if (panContainerRef.current) {
        panContainerRef.current.style.transform = `matrix(${matrixData.toString()})`;
      }
    }
  };

  if (noWrap) {
    return children;
  }

  return (
    <div
      ref={panWrapperRef}
      className={`pan-wrapper ${className || ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <div
        ref={panContainerRef}
        className="pan-container"
      >
        {children}
      </div>
    </div>
  );
};

export default memo(PanZoom);
