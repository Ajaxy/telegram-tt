import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import { selectAnimatedEmoji } from '../../../global/selectors';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';

import styles from './EmptyFolder.module.scss';

type StateProps = {
  animatedEmoji?: ApiSticker;
};

const ICON_SIZE = 96;

// TODO[forums] Open create topic screen if has permission
const EmptyTopic: FC<StateProps> = ({
  animatedEmoji,
}) => {
  const lang = useLang();

  const handleCreateTopic = useCallback(() => {
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.sticker}>
        {animatedEmoji && <AnimatedIconFromSticker sticker={animatedEmoji} size={ICON_SIZE} />}
      </div>
      <h3 className={styles.title} dir="auto">{lang('ChatList.EmptyTopicsTitle')}</h3>
      <Button
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        fluid
        pill
        onClick={handleCreateTopic}
        size="smaller"
        isRtl={lang.isRtl}
      >
        <i className="icon-add" />
        <div className={styles.buttonText}>
          {lang('ChatList.EmptyTopicsCreate')}
        </div>
      </Button>
    </div>
  );
};

export default memo(withGlobal((global): StateProps => {
  return {
    animatedEmoji: selectAnimatedEmoji(global, '👀'),
  };
})(EmptyTopic));
