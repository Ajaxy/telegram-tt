import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './PinnedMessageNavigation.module.scss';

type OwnProps = {
  count: number;
  index: number;
};

const BORDER_MASK_LEVEL = 4;

const PinnedMessageNavigation: FC<OwnProps> = ({
  count, index,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const markupParams = useMemo(() => {
    return calculateMarkup(count, index);
  }, [count, index]);

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const {
      trackHeight,
      trackTranslateY,
      markHeight,
      markTranslateY,
      clipPathId,
      clipPath,
    } = markupParams;

    const firstChild = containerRef.current.firstElementChild;
    if (containerRef?.current) {
      const currentElement = containerRef.current;
      const { style } = currentElement;
      style.height = `${trackHeight}px`;
      style.transform = `translateY(-${trackTranslateY}px)`;
      style.clipPath = `url("#${clipPathId}")`;
      const svg = currentElement.querySelector('svg');
      const div = currentElement.querySelector('div');
      const defs = currentElement.querySelector('defs');
      if (!svg) {
        if (firstChild) {
          firstChild.innerHTML = `<svg height="0" width="0"><defs> ${clipPath} </defs></svg>`;
        }
      }
      if (defs) {
        defs.innerHTML = clipPath;
      }
      if (div) {
        div.style.height = `${markHeight}px`;
        div.style.transform = `translateY(${markTranslateY}px)`;
      }
    }
  }, [markupParams]);

  if (count === 1) {
    return (
      <div className={styles.pinnedMessageBorder}>
        <div
          className={styles.pinnedMessageBorderWrapper1}
          ref={containerRef}
        />
      </div>
    );
  }

  const {
    trackHeight, trackTranslateY, markHeight, markTranslateY, clipPathId,
  } = markupParams;

  return (
    <div className={buildClassName(
      styles.pinnedMessageBorder,
      count > BORDER_MASK_LEVEL && styles.pinnedMessageBorderMask,
    )}
    >
      <div
        className={styles.pinnedMessageBorderWrapper}
        ref={containerRef}
        style={
          `clip-path: url("#${clipPathId}"); width: 2px;
          height: ${trackHeight}px; transform: translateY(-${trackTranslateY}px);`
        }
      >
        <span />
        <div
          className={styles.pinnedMessageBorderMark}
          style={`--height: ${markHeight}px; --translate-y: ${markTranslateY}px; `
            + `--translate-track: ${trackTranslateY}px;`}
        />
      </div>
    </div>
  );
};

function calculateMarkup(count: number, index: number) {
  const reverseIndex = count - index - 1;
  const barHeight = getBarHeight(count);
  const markHeight = getMarkHeight(count, reverseIndex);
  const trackHeight = getTrackHeight(count, barHeight);

  const clipPathId = `clipPath${count}`;
  const clipPath = getClipPath(clipPathId, barHeight, count);

  const markTranslateY = getMarkTranslateY(reverseIndex, barHeight, count);
  const trackTranslateY = getTrackTranslateY(reverseIndex, count, barHeight, trackHeight);
  return {
    markHeight,
    clipPath,
    markTranslateY,
    trackTranslateY,
    trackHeight,
    clipPathId,
  };
}

function getBarHeight(count: number): number {
  let barHeight = 8;
  if (count === 1) {
    barHeight = 36;
  } else if (count === 2) {
    barHeight = 17;
  } else if (count === 3) {
    barHeight = 11;
  } else if (count === 4) {
    barHeight = 7.5;
  } else if (count > 3) {
    barHeight = 7.5;
  }

  return barHeight;
}

function getMarkHeight(count: number, index: number) {
  let barHeight = 36;
  if (count === 1) {
    barHeight = 36;
  } else if (count === 2) {
    barHeight = 17;
  } else if (count === 3) {
    barHeight = index === 1 ? 12 : 11;
  } else if (count === 4) {
    barHeight = 7.5;
  } else if (count > 3) {
    barHeight = 7.5;
  }

  return barHeight;
}

function getTrackHeight(count: number, barHeight: number) {
  return count <= 3 ? 36 : barHeight * count + 2 * (count - 1);
}

function getClipPath(id: string, barHeight: number, count: number) {
  const radius = 1;

  let d = '';
  if (count === 3) {
    d = drawRect(0, 0, 2, barHeight, radius)
      + drawRect(0, 12, 2, barHeight + 1, radius)
      + drawRect(0, 25, 2, barHeight, radius);
  } else {
    for (let i = 0; i < count; i++) {
      d += drawRect(0, (barHeight + 2) * i, 2, barHeight, radius);
    }
  }

  return (
    `<clipPath id="${id}">
      <path d="${d}" />
    </clipPath>`
  );
}

function drawRect(x: number, y: number, width: number, height: number, radius: number) {
  return `M${x},${y + radius}a${radius},${radius},0,0,1,
  ${width},0v${height - 2 * radius}a${radius},${radius},0,0,1,${-width},0Z`;
}

function getMarkTranslateY(index: number, barHeight: number, count: number) {
  if (count === 1) {
    return 0;
  } else if (count === 2) {
    return index === 0 ? 0 : barHeight + 2;
  }

  if (count === 3) {
    if (index === 0) {
      return 0;
    } else if (index === 1) {
      return 12;
    }

    return 25;
  } else {
    return (barHeight + 2) * index;
  }
}

function getTrackTranslateY(index: number, count: number, barHeight: number, trackHeight: number) {
  if (count <= 4) {
    return 0;
  }

  if (index <= 1) {
    return 0;
  } else if (index >= count - 2) {
    return trackHeight - 36;
  }

  return (barHeight + 4) / 2 + (index - 2) * (barHeight + 2);
}

export default memo(PinnedMessageNavigation);
