import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import { memo, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';

import './DropTarget.scss';

export type OwnProps = {
  isQuick?: boolean;
  isGeneric?: boolean;
  onFileSelect: (e: React.DragEvent<HTMLDivElement>) => void;
};

const DropTarget: FC<OwnProps> = ({ isQuick, isGeneric, onFileSelect }) => {
  const ref = useRef<HTMLDivElement>();

  const lang = useLang();

  const [isHovered, markHovered, unmarkHovered] = useFlag();

  const handleDragLeave = useLastCallback((e: React.DragEvent<HTMLDivElement>) => {
    const { relatedTarget: toTarget } = e;

    if (toTarget) {
      e.stopPropagation();
    }

    unmarkHovered();
  });

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
        <div className="title">{lang('FileDropZoneTitle')}</div>
        {!isGeneric && (
          <div className="description">
            {isQuick ? lang('FileDropZoneQuick') : lang('FileDropZoneNoCompression')}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(DropTarget);
