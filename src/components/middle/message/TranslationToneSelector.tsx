import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiAiComposeStyle } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CustomEmoji from '../../common/CustomEmoji';
import { getStyleTitle } from '../composer/AiMessageEditorModal/helpers';

import styles from './TranslationToneSelector.module.scss';

const EMOJI_SIZE = 20;
const EMPTY_AI_COMPOSE_STYLES: ApiAiComposeStyle[] = [];

type OwnProps = {
  selectedTone?: string;
  style?: string;
  onSelectTone: (tone?: string) => void;
};

type StateProps = {
  aiComposeStyles: ApiAiComposeStyle[];
};

const TranslationToneSelector = ({
  selectedTone,
  style,
  aiComposeStyles,
  onSelectTone,
}: OwnProps & StateProps) => {
  const lang = useLang();

  const handleToneClick = useLastCallback((tone?: string) => {
    onSelectTone(tone);
  });

  if (!aiComposeStyles.length) return undefined;

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
        {aiComposeStyles.map(({ tone, documentId, title }) => (
          <div
            key={tone}
            className={buildClassName(styles.item, selectedTone === tone && styles.selected)}
            onClick={() => handleToneClick(tone)}
          >
            {documentId && (
              <CustomEmoji
                documentId={documentId}
                size={EMOJI_SIZE}
                shouldNotLoop
              />
            )}
            <span className={styles.title}>{getStyleTitle(lang, tone, title)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      aiComposeStyles: global.appConfig.aiComposeStyles || EMPTY_AI_COMPOSE_STYLES,
    };
  },
)(TranslationToneSelector));
