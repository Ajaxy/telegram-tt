import { memo } from '../../../../lib/teact/teact';

import type { ApiComposedMessageWithAI, ApiFormattedText } from '../../../../api/types';

import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useLang from '../../../../hooks/useLang';

import ExpandableText from '../../../ui/ExpandableText';
import { AiEditorCopyButton, AiEditorErrorMessage, AiEditorResultArea } from './AiEditorShared';

import sharedStyles from './AiEditorShared.module.scss';
import modalStyles from './AiMessageEditorModal.module.scss';
import styles from './AiTextFixEditor.module.scss';

type OwnProps = {
  text?: ApiFormattedText;
  isLoading?: boolean;
  result?: ApiComposedMessageWithAI;
  error?: 'floodPremium' | 'aiError' | 'generic';
  isPremium?: boolean;
};

const AiTextFixEditor = ({
  text,
  isLoading,
  result,
  error,
  isPremium,
}: OwnProps) => {
  const lang = useLang();

  const hasError = Boolean(error);
  const displayResult = result?.diffText || result?.resultText;

  function renderResultText() {
    if (hasError) {
      return <AiEditorErrorMessage error={error} isPremium={isPremium} />;
    }

    return displayResult && renderDiffText(displayResult);
  }

  return (
    <div className={modalStyles.editorBlock}>
      <div className={styles.section}>
        <div className={sharedStyles.labelRow}>
          <span className={sharedStyles.label}>
            {lang('AiMessageEditorOriginal')}
          </span>
        </div>
        <ExpandableText text={text?.text} />
      </div>

      <div className={sharedStyles.separator} />

      <div className={sharedStyles.labelRow}>
        <span className={sharedStyles.label}>{lang('AiMessageEditorResult')}</span>
      </div>
      <AiEditorResultArea isLoading={isLoading}>
        {renderResultText()}
      </AiEditorResultArea>
      <AiEditorCopyButton
        textToCopy={result?.resultText?.text || text?.text}
        isHidden={isLoading || hasError || !displayResult?.text}
      />
    </div>
  );
};

function renderDiffText(formattedText: ApiFormattedText) {
  const { text, entities } = formattedText;

  return renderTextWithEntities({
    text,
    entities,
  });
}

export default memo(AiTextFixEditor);
