import type { TeactNode } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import { ApiMessageEntityTypes } from '../../../api/types';

import { createClassNameBuilder } from '../../../util/buildClassName';
import stopEvent from '../../../util/stopEvent';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';

import './Spoiler.scss';

type OwnProps = {
  children?: TeactNode;
  containerId?: string;
};

const revealByContainerId = new Map<string, VoidFunction[]>();

const buildClassName = createClassNameBuilder('Spoiler');

const Spoiler = ({
  children,
  containerId,
}: OwnProps) => {
  const contentRef = useRef<HTMLDivElement>();

  const [isRevealed, revealSpoiler] = useFlag();

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!containerId) return;

    if (!isRevealed) {
      stopEvent(e);
    }

    revealByContainerId.get(containerId)?.forEach((reveal) => reveal());
  });

  useEffect(() => {
    if (!containerId) {
      return undefined;
    }

    if (revealByContainerId.has(containerId)) {
      revealByContainerId.get(containerId)!.push(revealSpoiler);
    } else {
      revealByContainerId.set(containerId, [revealSpoiler]);
    }

    return () => {
      revealByContainerId.delete(containerId);
    };
  }, [containerId]);

  return (
    <span
      className={buildClassName(
        '&',
        !isRevealed && 'concealed',
        !isRevealed && Boolean(containerId) && 'animated',
      )}
      onClick={containerId && !isRevealed ? handleClick : undefined}
      data-entity-type={ApiMessageEntityTypes.Spoiler}
    >
      <span className={buildClassName('content')} ref={contentRef}>
        {children}
      </span>
    </span>
  );
};

export default memo(Spoiler);
