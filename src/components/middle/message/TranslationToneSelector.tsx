import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiAiComposeToneType, ApiInputAiComposeTone } from '../../../api/types';

import { compareAiTones, getInputTone } from '../../../util/aiComposeTones';
import buildClassName from '../../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CustomEmoji from '../../common/CustomEmoji';

import styles from './TranslationToneSelector.module.scss';

const EMOJI_SIZE = 20;

type OwnProps = {
  selectedTone?: ApiInputAiComposeTone;
  style?: string;
  onSelectTone: (tone?: ApiInputAiComposeTone) => void;
};

type StateProps = {
  tones: ApiAiComposeToneType[];
};

const TranslationToneSelector = ({
  selectedTone,
  style,
  tones,
  onSelectTone,
}: OwnProps & StateProps) => {
  const lang = useLang();

  const handleToneClick = useLastCallback((tone?: ApiInputAiComposeTone) => {
    onSelectTone(tone);
  });

  if (!tones.length) return undefined;

  return (
    <div className={buildClassName(styles.root, 'TranslationToneSelector')} style={style}>
      <div className={styles.itemsWrapper}>
        <div
          className={buildClassName(styles.item, !selectedTone && styles.selected)}
          onClick={() => handleToneClick(undefined)}
        >
          <span className={styles.neutralEmoji}>🏳️</span>
          <span className={styles.title}>{lang('TranslationToneNeutral')}</span>
        </div>
        {tones.map((entry) => {
          const inputTone = getInputTone(entry);

          return (
            <div
              key={'tone' in entry ? entry.tone : entry.id}
              className={buildClassName(
                styles.item,
                compareAiTones(selectedTone, inputTone) && styles.selected,
              )}
              onClick={() => handleToneClick(inputTone)}
            >
              {entry.emojiId && (
                <CustomEmoji
                  documentId={entry.emojiId}
                  size={EMOJI_SIZE}
                  shouldNotLoop
                />
              )}
              <span className={styles.title}>{entry.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      tones: global.aiComposeTones?.tones ?? MEMO_EMPTY_ARRAY,
    };
  },
)(TranslationToneSelector));
