// Based on
// https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/ui/grouped_layout.cpp
// https://github.com/overtake/TelegramSwift/blob/master/Telegram-Mac/GroupedLayout.swift#L83

import type { ApiDimensions, ApiMessage } from '../../../../api/types';
import type { IAlbum } from '../../../../types';

import { getMessageContent } from '../../../../global/helpers';
import { clamp } from '../../../../util/math';
import { getAvailableWidth } from '../../../common/helpers/mediaDimensions';
import { calculateMediaDimensions } from './mediaDimensions';

export const AlbumRectPart = {
  None: 0,
  Top: 1,
  Right: 2,
  Bottom: 4,
  Left: 8,
};

type IAttempt = {
  lineCounts: number[];
  heights: number[];
};
export type IMediaDimensions = {
  width: number;
  height: number;
  x: number;
  y: number;
};
type IMediaLayout = {
  dimensions: IMediaDimensions;
  sides: number;
};
type ILayoutParams = {
  ratios: number[];
  proportions: string;
  averageRatio: number;
  maxWidth: number;
  minWidth: number;
  maxHeight: number;
  spacing: number;
};
export type IAlbumLayout = {
  layout: IMediaLayout[];
  containerStyle: ApiDimensions;
};

function getRatios(messages: ApiMessage[], isSingleMessage: boolean, isMobile: boolean) {
  const isOutgoing = messages[0].isOutgoing;
  const allMedia = (isSingleMessage
    ? messages[0].content.paidMedia!.extendedMedia.map((media) => (
      'mediaType' in media ? media : (media.photo || media.video)
    ))
    : messages.map((message) => (
      getMessageContent(message).photo || getMessageContent(message).video
    ))
  ).filter(Boolean);
  return allMedia.map(
    (media) => {
      const dimensions = calculateMediaDimensions({
        media,
        isOwn: isOutgoing,
        isMobile,
      }) as ApiDimensions;

      return dimensions.width / dimensions.height;
    },
  );
}

function getProportions(ratios: number[]) {
  return ratios.map((ratio) => (ratio > 1.2 ? 'w' : (ratio < 0.8 ? 'n' : 'q'))).join('');
}

function getAverageRatio(ratios: number[]) {
  return ratios.reduce((result, ratio) => ratio + result, 1) / ratios.length;
}

function accumulate(list: number[], initValue: number) {
  return list.reduce((accumulator, item) => accumulator + item, initValue);
}

function cropRatios(ratios: number[], averageRatio: number) {
  return ratios.map((ratio) => {
    return (averageRatio > 1.1 ? clamp(ratio, 1, 2.75) : clamp(ratio, 0.6667, 1));
  });
}

function calculateContainerSize(layout: IMediaLayout[]) {
  const styles: ApiDimensions = { width: 0, height: 0 };
  layout.forEach(({
    dimensions,
    sides,
  }) => {
    if (sides & AlbumRectPart.Right) {
      styles.width = dimensions.width + dimensions.x;
    }
    if (sides & AlbumRectPart.Bottom) {
      styles.height = dimensions.height + dimensions.y;
    }
  });

  return styles;
}

export function calculateAlbumLayout(
  isOwn: boolean,
  noAvatars: boolean,
  album: IAlbum,
  isMobile: boolean,
): IAlbumLayout {
  const spacing = 2;
  const ratios = getRatios(album.messages, Boolean(album.isPaidMedia), isMobile);
  const proportions = getProportions(ratios);
  const averageRatio = getAverageRatio(ratios);
  const albumCount = ratios.length;
  const forceCalc = ratios.some((ratio) => ratio > 2);
  const maxWidth = getAvailableWidth(isOwn, false, noAvatars, isMobile);
  const maxHeight = maxWidth;

  let layout;

  const params = {
    ratios,
    proportions,
    averageRatio,
    maxWidth,
    minWidth: 100,
    maxHeight,
    spacing,
  };

  if (albumCount >= 5 || forceCalc) {
    layout = layoutWithComplexLayouter(params);
  } else if (albumCount === 2) {
    layout = layoutTwo(params);
  } else if (albumCount === 3) {
    layout = layoutThree(params);
  } else {
    layout = layoutFour(params);
  }

  return {
    layout,
    containerStyle: calculateContainerSize(layout),
  };
}

function layoutWithComplexLayouter({
  ratios: originalRatios,
  averageRatio,
  maxWidth,
  minWidth,
  spacing,
  maxHeight = (4 * maxWidth) / 3,
}: ILayoutParams) {
  const ratios = cropRatios(originalRatios, averageRatio);
  const count = originalRatios.length;
  const result = new Array(count);
  const attempts: IAttempt[] = [];

  const multiHeight = (offset: number, attemptCount: number) => {
    const attemptRatios = ratios.slice(offset, offset + attemptCount);
    const sum = accumulate(attemptRatios, 0);

    return (maxWidth - (attemptCount - 1) * spacing) / sum;
  };

  const pushAttempt = (lineCounts: number[]) => {
    const heights: number[] = [];
    let offset = 0;
    lineCounts.forEach((currentCount) => {
      heights.push(multiHeight(offset, currentCount));
      offset += currentCount;
    });

    attempts.push({
      lineCounts,
      heights,
    });
  };

  for (let first = 1; first !== count; ++first) {
    const second = count - first;
    if (first <= 3 && second <= 3) {
      pushAttempt([first, second]);
    }
  }

  for (let first = 1; first !== count - 1; ++first) {
    for (let second = 1; second !== count - first; ++second) {
      const third = count - first - second;
      if (first <= 3 && second <= (averageRatio < 0.85 ? 4 : 3) && third <= 3) {
        pushAttempt([first, second, third]);
      }
    }
  }

  for (let first = 1; first !== count - 1; ++first) {
    for (let second = 1; second !== count - first; ++second) {
      for (let third = 1; third !== count - first - second; ++third) {
        const fourth = count - first - second - third;
        if (first <= 3 && second <= 3 && third <= 3 && fourth <= 4) {
          pushAttempt([first, second, third, fourth]);
        }
      }
    }
  }

  let optimalAttempt: IAttempt | undefined;
  let optimalDiff = 0;
  for (let i = 0; i < attempts.length; i++) {
    const {
      heights,
      lineCounts,
    } = attempts[i];
    const lineCount = lineCounts.length;
    const totalHeight = accumulate(heights, 0) + spacing * (lineCount - 1);
    const minLineHeight = Math.min(...heights);
    const bad1 = minLineHeight < minWidth ? 1.5 : 1;
    const bad2 = (() => {
      for (let line = 1; line !== lineCount; ++line) {
        if (lineCounts[line - 1] > lineCounts[line]) {
          return 1.5;
        }
      }

      return 1;
    })();
    const diff = Math.abs(totalHeight - maxHeight) * bad1 * bad2;

    if (!optimalAttempt || diff < optimalDiff) {
      optimalAttempt = attempts[i];
      optimalDiff = diff;
    }
  }

  const optimalCounts = optimalAttempt!.lineCounts;
  const optimalHeights = optimalAttempt!.heights;
  const rowCount = optimalCounts.length;
  let index = 0;
  let y = 0;
  for (let row = 0; row !== rowCount; ++row) {
    const colCount = optimalCounts[row];
    const lineHeight = optimalHeights[row];
    const height = Math.round(lineHeight);
    let x = 0;

    for (let col = 0; col !== colCount; ++col) {
      const sides = AlbumRectPart.None
        | (row === 0 ? AlbumRectPart.Top : AlbumRectPart.None)
        | (row === rowCount - 1 ? AlbumRectPart.Bottom : AlbumRectPart.None)
        | (col === 0 ? AlbumRectPart.Left : AlbumRectPart.None)
        | (col === colCount - 1 ? AlbumRectPart.Right : AlbumRectPart.None);
      const ratio = ratios[index];
      const width = col === colCount - 1 ? maxWidth - x : Math.round(ratio * lineHeight);
      result[index] = {
        dimensions: {
          x,
          y,
          width,
          height,
        },
        sides,
      };
      x += width + spacing;
      ++index;
    }
    y += height + spacing;
  }

  return result;
}

function layoutTwo(params: ILayoutParams) {
  const {
    ratios,
    proportions,
    averageRatio,
  } = params;
  return proportions === 'ww' && averageRatio > 1.4 && ratios[1] - ratios[0] < 0.2
    ? layoutTwoTopBottom(params)
    : proportions === 'ww' || proportions === 'qq'
      ? layoutTwoLeftRightEqual(params)
      : layoutTwoLeftRight(params);
}

function layoutTwoTopBottom(params: ILayoutParams) {
  const {
    ratios,
    maxWidth,
    spacing,
    maxHeight,
  } = params;
  const height = Math.round(Math.min(maxWidth / ratios[0], Math.min(maxWidth / ratios[1], (maxHeight - spacing) / 2)));

  return [{
    dimensions: {
      x: 0,
      y: 0,
      width: maxWidth,
      height,
    },
    sides: AlbumRectPart.Left | AlbumRectPart.Top | AlbumRectPart.Right,
  }, {
    dimensions: {
      x: 0,
      y: height + spacing,
      width: maxWidth,
      height,
    },
    sides: AlbumRectPart.Left | AlbumRectPart.Bottom | AlbumRectPart.Right,
  }];
}

function layoutTwoLeftRightEqual(params: ILayoutParams) {
  const {
    ratios,
    maxWidth,
    spacing,
    maxHeight,
  } = params;
  const width = (maxWidth - spacing) / 2;
  const height = Math.round(Math.min(width / ratios[0], Math.min(width / ratios[1], maxHeight)));
  return [{
    dimensions: {
      x: 0,
      y: 0,
      width,
      height,
    },
    sides: AlbumRectPart.Top | AlbumRectPart.Left | AlbumRectPart.Bottom,
  }, {
    dimensions: {
      x: width + spacing,
      y: 0,
      width,
      height,
    },
    sides: AlbumRectPart.Top | AlbumRectPart.Right | AlbumRectPart.Bottom,
  }];
}

function layoutTwoLeftRight(params: ILayoutParams) {
  const {
    ratios,
    minWidth,
    maxWidth,
    spacing,
    maxHeight,
  } = params;
  const minimalWidth = Math.round(1.5 * minWidth);
  const secondWidth = Math.min(
    Math.round(
      Math.max(
        0.4 * (maxWidth - spacing),
        (maxWidth - spacing) / ratios[0] / (1 / ratios[0] + 1 / ratios[1]),
      ),
    ),
    maxWidth - spacing - minimalWidth,
  );
  const firstWidth = maxWidth - secondWidth - spacing;
  const height = Math.min(maxHeight, Math.round(Math.min(firstWidth / ratios[0], secondWidth / ratios[1])));

  return [{
    dimensions: {
      x: 0,
      y: 0,
      width: firstWidth,
      height,
    },
    sides: AlbumRectPart.Top | AlbumRectPart.Left | AlbumRectPart.Bottom,
  }, {
    dimensions: {
      x: firstWidth + spacing,
      y: 0,
      width: secondWidth,
      height,
    },
    sides: AlbumRectPart.Top | AlbumRectPart.Right | AlbumRectPart.Bottom,
  }];
}

function layoutThree(params: ILayoutParams) {
  const { proportions } = params;

  return proportions[0] === 'n'
    ? layoutThreeLeftAndOther(params)
    : layoutThreeTopAndOther(params);
}

function layoutThreeLeftAndOther(params: ILayoutParams) {
  const {
    maxHeight,
    spacing,
    ratios,
    maxWidth,
    minWidth,
  } = params;
  const firstHeight = maxHeight;
  const thirdHeight = Math.round(
    Math.min(
      (maxHeight - spacing) / 2,
      (ratios[1] * (maxWidth - spacing)) / (ratios[2] + ratios[1]),
    ),
  );
  const secondHeight = firstHeight - thirdHeight - spacing;
  const rightWidth = Math.max(
    minWidth,
    Math.round(
      Math.min(
        (maxWidth - spacing) / 2,
        Math.min(
          thirdHeight * ratios[2],
          secondHeight * ratios[1],
        ),
      ),
    ),
  );
  const leftWidth = Math.min(Math.round(firstHeight * ratios[0]), maxWidth - spacing - rightWidth);

  return [{
    dimensions: {
      x: 0,
      y: 0,
      width: leftWidth,
      height: firstHeight,
    },
    sides: AlbumRectPart.Top | AlbumRectPart.Left | AlbumRectPart.Bottom,
  }, {
    dimensions: {
      x: leftWidth + spacing,
      y: 0,
      width: rightWidth,
      height: secondHeight,
    },
    sides: AlbumRectPart.Top | AlbumRectPart.Right,
  }, {
    dimensions: {
      x: leftWidth + spacing,
      y: secondHeight + spacing,
      width: rightWidth,
      height: thirdHeight,
    },
    sides: AlbumRectPart.Bottom | AlbumRectPart.Right,
  }];
}

function layoutThreeTopAndOther(params: ILayoutParams) {
  const {
    maxWidth,
    ratios,
    maxHeight,
    spacing,
  } = params;
  const firstWidth = maxWidth;
  const firstHeight = Math.round(Math.min(firstWidth / ratios[0], 0.66 * (maxHeight - spacing)));
  const secondWidth = (maxWidth - spacing) / 2;
  const secondHeight = Math.min(
    maxHeight - firstHeight - spacing,
    Math.round(Math.min(
      secondWidth / ratios[1],
      secondWidth / ratios[2],
    )),
  );
  const thirdWidth = firstWidth - secondWidth - spacing;

  return [{
    dimensions: {
      x: 0,
      y: 0,
      width: firstWidth,
      height: firstHeight,
    },
    sides: AlbumRectPart.Left | AlbumRectPart.Top | AlbumRectPart.Right,
  }, {
    dimensions: {
      x: 0,
      y: firstHeight + spacing,
      width: secondWidth,
      height: secondHeight,
    },
    sides: AlbumRectPart.Bottom | AlbumRectPart.Left,
  }, {
    dimensions: {
      x: secondWidth + spacing,
      y: firstHeight + spacing,
      width: thirdWidth,
      height: secondHeight,
    },
    sides: AlbumRectPart.Bottom | AlbumRectPart.Right,
  }];
}

function layoutFour(params: ILayoutParams) {
  const { proportions } = params;

  return proportions[0] === 'w'
    ? layoutFourTopAndOther(params)
    : layoutFourLeftAndOther(params);
}

function layoutFourTopAndOther({
  maxWidth,
  ratios,
  spacing,
  maxHeight,
  minWidth,
}: ILayoutParams) {
  const w = maxWidth;
  const h0 = Math.round(Math.min(w / ratios[0], 0.66 * (maxHeight - spacing)));
  const h = Math.round((maxWidth - 2 * spacing) / (ratios[1] + ratios[2] + ratios[3]));
  const w0 = Math.max(minWidth, Math.round(Math.min(0.4 * (maxWidth - 2 * spacing), h * ratios[1])));
  const w2 = Math.round(Math.max(Math.max(minWidth, 0.33 * (maxWidth - 2 * spacing)), h * ratios[3]));
  const w1 = w - w0 - w2 - 2 * spacing;
  const h1 = Math.min(maxHeight - h0 - spacing, h);

  return [{
    dimensions: {
      x: 0,
      y: 0,
      width: w,
      height: h0,
    },
    sides: AlbumRectPart.Left | AlbumRectPart.Top | AlbumRectPart.Right,
  }, {
    dimensions: {
      x: 0,
      y: h0 + spacing,
      width: w0,
      height: h1,
    },
    sides: AlbumRectPart.Bottom | AlbumRectPart.Left,
  }, {
    dimensions: {
      x: w0 + spacing,
      y: h0 + spacing,
      width: w1,
      height: h1,
    },
    sides: AlbumRectPart.Bottom,
  }, {
    dimensions: {
      x: w0 + spacing + w1 + spacing,
      y: h0 + spacing,
      width: w2,
      height: h1,
    },
    sides: AlbumRectPart.Right | AlbumRectPart.Bottom,
  }];
}

function layoutFourLeftAndOther({
  maxHeight,
  ratios,
  maxWidth,
  spacing,
  minWidth,
}: ILayoutParams) {
  const h = maxHeight;
  const w0 = Math.round(Math.min(h * ratios[0], 0.6 * (maxWidth - spacing)));
  const w = Math.round((maxHeight - 2 * spacing) / (1 / ratios[1] + 1 / ratios[2] + 1 / ratios[3]));
  const h0 = Math.round(w / ratios[1]);
  const h1 = Math.round(w / ratios[2]);
  const h2 = h - h0 - h1 - 2 * spacing;
  const w1 = Math.max(minWidth, Math.min(maxWidth - w0 - spacing, w));

  return [{
    dimensions: {
      x: 0,
      y: 0,
      width: w0,
      height: h,
    },
    sides: AlbumRectPart.Top | AlbumRectPart.Left | AlbumRectPart.Bottom,
  }, {
    dimensions: {
      x: w0 + spacing,
      y: 0,
      width: w1,
      height: h0,
    },
    sides: AlbumRectPart.Top | AlbumRectPart.Right,
  }, {
    dimensions: {
      x: w0 + spacing,
      y: h0 + spacing,
      width: w1,
      height: h1,
    },
    sides: AlbumRectPart.Right,
  }, {
    dimensions: {
      x: w0 + spacing,
      y: h0 + h1 + 2 * spacing,
      width: w1,
      height: h2,
    },
    sides: AlbumRectPart.Bottom | AlbumRectPart.Right,
  }];
}
