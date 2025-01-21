import type { FC } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useEffectOnce from '../../../hooks/useEffectOnce';
import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';

import Icon from '../../common/icons/Icon';

import './DropTarget.scss';

export type OwnProps = {
  isQuick?: boolean;
  isGeneric?: boolean;
  onFileSelect: (e: React.DragEvent<HTMLDivElement>) => void;
};

const DropTarget: FC<OwnProps> = ({ isQuick, isGeneric, onFileSelect }) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const svgRef = useRef<SVGSVGElement>(null);

  const [isHovered, markHovered, unmarkHovered] = useFlag();

  const handleDragLeave = useLastCallback((e: React.DragEvent<HTMLDivElement>) => {
    const { relatedTarget: toTarget } = e;

    if (toTarget) {
      e.stopPropagation();
    }

    unmarkHovered();
  });

  const handleResize = useLastCallback(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const { width, height } = svg.getBoundingClientRect();
    svg.viewBox.baseVal.width = width;
    svg.viewBox.baseVal.height = height;
  });

  // Can't listen for SVG resize
  useResizeObserver(ref, handleResize);

  useEffectOnce(handleResize);

  const className = buildClassName(
    'DropTarget',
    isHovered && 'hovered',
  );

  return (
    <div
      className={className}
      ref={ref}
      onDrop={onFileSelect}
      onDragEnter={markHovered}
      onDragLeave={handleDragLeave}
      data-dropzone
    >
      <svg className="target-outline-container">
        <rect className="target-outline" x="0" y="0" width="100%" height="100%" rx="8" />
      </svg>
      <div className="target-content">
        <Icon name={isQuick ? 'photo' : 'document'} />
        <div className="title">Drop files here to send them</div>
        {!isGeneric && <div className="description">{isQuick ? 'in a quick way' : 'without compression'}</div>}
      </div>
    </div>
  );
};

export default memo(DropTarget);
