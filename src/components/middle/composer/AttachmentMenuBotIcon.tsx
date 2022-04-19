import React, { FC, memo, useMemo } from '../../../lib/teact/teact';

import { ISettings } from '../../../types';
import { ApiDocument, ApiMediaFormat } from '../../../api/types';

import { IS_COMPACT_MENU } from '../../../util/environment';
import useMedia from '../../../hooks/useMedia';
import { getDocumentMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import styles from './AttachmentMenuBotIcon.module.scss';

type OwnProps = {
  icon: ApiDocument;
  theme: ISettings['theme'];
};

const ADDITIONAL_STROKE_WIDTH = '0.5px';
const DARK_THEME_COLOR = 'rgb(170, 170, 170)';
const LIGHT_THEME_COLOR = 'rgb(112, 117, 121)';
const COLOR_REPLACE_PATTERN = /#fff/gi;

const AttachmentMenuBotIcon: FC<OwnProps> = ({
  icon, theme,
}) => {
  const mediaData = useMedia(getDocumentMediaHash(icon), false, ApiMediaFormat.Text);

  const iconSvg = useMemo(() => {
    if (!mediaData) return '';
    const color = theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;

    const mediaDataWithReplacedColors = mediaData.replace(COLOR_REPLACE_PATTERN, color);
    const doc = new DOMParser().parseFromString(mediaDataWithReplacedColors, 'image/svg+xml');
    doc.querySelectorAll('path').forEach((l) => {
      l.style.stroke = color;
      l.style.strokeWidth = ADDITIONAL_STROKE_WIDTH;
    });

    return `data:image/svg+xml;utf8,${doc.documentElement.outerHTML}`;
  }, [mediaData, theme]);

  return (
    <i className={buildClassName(styles.root, IS_COMPACT_MENU && styles.compact)}>
      <img src={iconSvg} alt="" className={buildClassName(styles.image, IS_COMPACT_MENU && styles.compact)} />
    </i>
  );
};

export default memo(AttachmentMenuBotIcon);
