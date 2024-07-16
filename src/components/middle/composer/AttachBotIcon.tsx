import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiDocument } from '../../../api/types';
import type { ISettings } from '../../../types';
import { ApiMediaFormat } from '../../../api/types';

import { getDocumentMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import useAppLayout from '../../../hooks/useAppLayout';
import useMedia from '../../../hooks/useMedia';

import styles from './AttachBotIcon.module.scss';

type OwnProps = {
  icon: ApiDocument;
  theme: ISettings['theme'];
};

const ADDITIONAL_STROKE_WIDTH = '0.5px';
const DARK_THEME_COLOR = 'rgb(170, 170, 170)';
const LIGHT_THEME_COLOR = 'rgb(112, 117, 121)';
const COLOR_REPLACE_PATTERN = /#fff/gi;

const AttachBotIcon: FC<OwnProps> = ({
  icon, theme,
}) => {
  const { isTouchScreen } = useAppLayout();
  const mediaData = useMedia(getDocumentMediaHash(icon, 'full'), false, ApiMediaFormat.Text);

  const iconSvg = useMemo(() => {
    if (!mediaData) return '';
    const color = theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;

    const mediaDataWithReplacedColors = mediaData.replace(COLOR_REPLACE_PATTERN, color);
    const doc = new DOMParser().parseFromString(mediaDataWithReplacedColors, 'image/svg+xml');
    doc.querySelectorAll('path').forEach((path) => {
      path.style.stroke = color;
      path.style.strokeWidth = ADDITIONAL_STROKE_WIDTH;
    });

    return `data:image/svg+xml;utf8,${doc.documentElement.outerHTML}`;
  }, [mediaData, theme]);

  return (
    <i className={buildClassName(styles.root, 'icon', !isTouchScreen && styles.compact)}>
      <img
        src={iconSvg}
        alt=""
        className={buildClassName(styles.image, !isTouchScreen && styles.compact)}
        draggable={false}
      />
    </i>
  );
};

export default memo(AttachBotIcon);
