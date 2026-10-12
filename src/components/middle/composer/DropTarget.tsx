import { memo, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import Icon from '../../common/icons/Icon';

import './DropTarget.scss';

export type OwnProps = {
  isQuick?: boolean;
  isGeneric?: boolean;
  onFileSelect: (e: React.DragEvent<HTMLDivElement>) => void;
};

const DropTarget = ({ isQuick, isGeneric, onFileSelect }: OwnProps) => {
  const ref = useRef<HTMLDivElement>();

  const lang = useLang();

  const [isHovered, markHovered, unmarkHovered] = useFlag();

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
      onDragLeave={unmarkHovered}
      data-dropzone
    >
      <svg className="target-outline-container">
        <rect className="target-outline" x="0" y="0" width="100%" height="100%" rx="8" />
      </svg>
      <div className="target-content">
        <Icon name={isQuick ? 'media' : 'document'} />
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
