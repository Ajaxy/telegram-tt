import { memo } from '../../lib/teact/teact';

import { emojiToFolderIcon } from '../../util/folderIconMap';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import CustomEmoji from './CustomEmoji';
import Icon from './icons/Icon';

import styles from './FolderIcon.module.scss';

const ICON_SIZE = 2.25 * REM;

type OwnProps = {
  emoji?: string;
  customEmojiId?: string;
  shouldAnimate?: boolean;
};

const FolderIcon = ({
  emoji,
  customEmojiId,
  shouldAnimate,
}: OwnProps) => {
  if (customEmojiId) {
    return <CustomEmoji documentId={customEmojiId} size={ICON_SIZE} shouldNotLoop={!shouldAnimate} />;
  }

  if (!emoji) {
    return <Icon name="folder-tabs-folder" />;
  }

  const iconName = emojiToFolderIcon(emoji);
  if (iconName) {
    return <Icon name={iconName} />;
  }

  return <div className={styles.emoji}>{renderText(emoji)}</div>;
};

export default memo(FolderIcon);
