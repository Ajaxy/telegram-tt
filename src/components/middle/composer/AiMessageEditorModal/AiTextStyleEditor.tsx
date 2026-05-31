import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiAiComposeToneType, ApiComposedMessageWithAI, ApiFormattedText, ApiInputAiComposeTone,
} from '../../../../api/types';
import type { TabWithProperties } from '../../../ui/TabList';

import { compareAiTones, getInputTone } from '../../../../util/aiComposeTones';
import buildClassName from '../../../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import CheckboxField from '../../../gili/templates/CheckboxField';
import TabList from '../../../ui/TabList';
import Transition from '../../../ui/Transition';
import { AiEditorCopyButton, AiEditorErrorMessage, AiEditorResultArea } from './AiEditorShared';

import sharedStyles from './AiEditorShared.module.scss';
import modalStyles from './AiMessageEditorModal.module.scss';
import styles from './AiTextStyleEditor.module.scss';

type OwnProps = {
  text?: ApiFormattedText;
  selectedTone?: ApiInputAiComposeTone;
  shouldEmojify?: boolean;
  isLoading?: boolean;
  result?: ApiComposedMessageWithAI;
  error?: 'floodPremium' | 'aiError' | 'generic';
  isPremium?: boolean;
};

type StateProps = {
  tones: ApiAiComposeToneType[];
};

const AiTextStyleEditor = ({
  text,
  selectedTone,
  shouldEmojify,
  isLoading,
  result,
  error,
  isPremium,
  tones,
}: OwnProps & StateProps) => {
  const {
    setAiMessageEditorStyleOptions,
    composeWithAiMessageEditor,
  } = getActions();

  const lang = useLang();

  const hasResult = Boolean(result?.resultText);
  const hasRequest = Boolean(selectedTone) || shouldEmojify;
  const shouldShowError = Boolean(error) && hasRequest;

  const styleTabs = useMemo((): TabWithProperties[] => tones.map((entry) => ({
    customEmojiDocumentId: entry.emojiId,
    title: entry.title,
  })), [tones]);

  const activeStyleIndex = tones.findIndex(
    (entry) => compareAiTones(selectedTone, getInputTone(entry)),
  );

  const handleStyleSelect = useLastCallback((index: number) => {
    const tone = getInputTone(tones[index]);
    setAiMessageEditorStyleOptions({ selectedTone: tone });
    composeWithAiMessageEditor({ tone, isEmojify: shouldEmojify });
  });

  const handleEmojifyChange = useLastCallback((newEmojify: boolean) => {
    if (!selectedTone && !newEmojify) {
      setAiMessageEditorStyleOptions({ shouldEmojify: newEmojify, clearResult: true });
    } else {
      setAiMessageEditorStyleOptions({ shouldEmojify: newEmojify });
      composeWithAiMessageEditor({ tone: selectedTone, isEmojify: newEmojify });
    }
  });

  const displayText = hasResult ? result?.resultText : text;
  const showResultLabel = hasRequest || isLoading;
  const displayLabel = showResultLabel ? lang('AiMessageEditorResult') : lang('AiMessageEditorOriginal');

  const transitionKey = (activeStyleIndex >= 0 ? activeStyleIndex : 0) + (shouldEmojify ? tones.length : 0);

  function renderPreviewText() {
    if (shouldShowError) {
      return <AiEditorErrorMessage error={error} isPremium={isPremium} />;
    }

    return (
      <div className={styles.previewText}>
        {displayText?.text && renderTextWithEntities({
          text: displayText.text,
          entities: displayText.entities,
        })}
      </div>
    );
  }

  return (
    <div className={buildClassName(modalStyles.editorBlock, styles.styleBlock)}>
      <TabList
        tabs={styleTabs}
        activeTab={activeStyleIndex}
        onSwitchTab={handleStyleSelect}
        className={styles.tabList}
        tabClassName={styles.tab}
        indicatorClassName={styles.tabListIndicator}
        itemAlignment="vertical"
      />

      <div className={sharedStyles.separator} />

      <div className={sharedStyles.optionsRow}>
        <Transition
          name="fade"
          activeKey={showResultLabel ? 1 : 0}
          className={sharedStyles.labelTransition}
          slideClassName={sharedStyles.labelSlide}
        >
          <span className={showResultLabel ? styles.resultLabel : styles.textLabel}>{displayLabel}</span>
        </Transition>
        <CheckboxField
          className={sharedStyles.emojifyCheckbox}
          controlClassName={sharedStyles.emojifyCheckboxControl}
          labelClassName={sharedStyles.emojifyCheckboxLabel}
          label={lang('AiMessageEditorEmojify')}
          checked={Boolean(shouldEmojify)}
          isRound
          onChange={handleEmojifyChange}
        />
      </div>

      <AiEditorResultArea isLoading={isLoading} transitionKey={transitionKey}>
        {renderPreviewText()}
      </AiEditorResultArea>
      <AiEditorCopyButton
        textToCopy={displayText?.text}
        isHidden={isLoading || shouldShowError || !displayText?.text}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      tones: global.aiComposeTones?.tones ?? MEMO_EMPTY_ARRAY,
    };
  },
)(AiTextStyleEditor));
