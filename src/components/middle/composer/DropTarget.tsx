import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import useFlag from '../../../hooks/useFlag';
import buildClassName from '../../../util/buildClassName';

import './DropTarget.scss';

export type OwnProps = {
  isQuick?: boolean;
  onFileSelect: (e: React.DragEvent<HTMLDivElement>) => void;
};

const DropTarget: FC<OwnProps> = ({ isQuick, onFileSelect }) => {
  const [isHovered, markHovered, unmarkHovered] = useFlag();

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const { relatedTarget: toTarget } = e;

    if (toTarget) {
      e.stopPropagation();
    }

    unmarkHovered();
  };

  const className = buildClassName(
    'DropTarget',
    isHovered && 'hovered',
  );

  return (
    <div
      className={className}
      onDrop={onFileSelect}
      onDragEnter={markHovered}
      onDragLeave={handleDragLeave}
      data-dropzone
    >
      <div className="target-content">
        <div className={`icon icon-${isQuick ? 'photo' : 'document'}`} />
        <div className="title">Drop files here to send them</div>
        <div className="description">{isQuick ? 'in a quick way' : 'without compression'}</div>
      </div>
    </div>
  );
};

export default memo(DropTarget);
