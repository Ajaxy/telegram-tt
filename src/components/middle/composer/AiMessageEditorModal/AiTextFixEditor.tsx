import { memo } from '../../../../lib/teact/teact';

import type { AiEditorContent, AiEditorResult } from '../../../../global/types';

import useLang from '../../../../hooks/useLang';

import {
  AiEditorCopyButton, AiEditorErrorMessage, AiEditorPreview, AiEditorResultArea,
} from './AiEditorShared';

import sharedStyles from './AiEditorShared.module.scss';
import modalStyles from './AiMessageEditorModal.module.scss';
import styles from './AiTextFixEditor.module.scss';

type OwnProps = {
  content?: AiEditorContent;
  isLoading?: boolean;
  result?: AiEditorResult;
  error?: 'floodPremium' | 'aiError' | 'generic';
  isPremium?: boolean;
};

const AiTextFixEditor = ({
  content,
  isLoading,
  result,
  error,
  isPremium,
}: OwnProps) => {
  const lang = useLang();

  const hasError = Boolean(error);

  function renderResultText() {
    if (hasError) {
      return <AiEditorErrorMessage error={error} isPremium={isPremium} />;
    }

    return <AiEditorPreview content={result} shouldShowDiff />;
  }

  return (
    <div className={modalStyles.editorBlock}>
      <div className={styles.section}>
        <div className={sharedStyles.labelRow}>
          <span className={sharedStyles.label}>
            {lang('AiMessageEditorOriginal')}
          </span>
        </div>
        <AiEditorPreview content={content} />
      </div>

      <div className={sharedStyles.separator} />

      <div className={sharedStyles.labelRow}>
        <span className={sharedStyles.label}>{lang('AiMessageEditorResult')}</span>
      </div>
      <AiEditorResultArea isLoading={isLoading}>
        {renderResultText()}
      </AiEditorResultArea>
      <AiEditorCopyButton
        content={result}
        isHidden={isLoading || hasError}
      />
    </div>
  );
};

export default memo(AiTextFixEditor);
