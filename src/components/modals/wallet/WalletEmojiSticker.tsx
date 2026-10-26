import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import { selectRestrictedEmoji } from '../../../global/selectors';
import renderText from '../../common/helpers/renderText';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';

import styles from './WalletEmojiSticker.module.scss';

type OwnProps = {
  emoji: string;
};

type StateProps = {
  sticker?: ApiSticker;
};

const STICKER_SIZE = 100;

// The sticker set keeps the emoji alike on every platform, and an emoji missing from it falls back to the image set
const WalletEmojiSticker = ({ emoji, sticker }: OwnProps & StateProps) => {
  return (
    <div className={styles.root}>
      {sticker ? (
        <AnimatedIconFromSticker sticker={sticker} size={STICKER_SIZE} />
      ) : renderText(emoji, ['hq_emoji'])}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { emoji }): Complete<StateProps> => ({
    sticker: selectRestrictedEmoji(global, emoji),
  }),
)(WalletEmojiSticker));
