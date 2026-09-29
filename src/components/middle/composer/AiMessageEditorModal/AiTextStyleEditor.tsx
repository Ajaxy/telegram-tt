import { memo, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiAiComposeToneType, ApiInputAiComposeTone,
} from '../../../../api/types';
import type { AiEditorContent, AiEditorResult } from '../../../../global/types';
import type { MenuItemContextAction } from '../../../ui/ListItem';
import type { TabWithProperties } from '../../../ui/TabList';

import { TME_LINK_PREFIX } from '../../../../config';
import { hasAiEditorContent } from '../../../../global/helpers/aiMessageEditor';
import { selectTabState } from '../../../../global/selectors';
import { compareAiTones, getInputTone } from '../../../../util/aiComposeTones';
import buildClassName from '../../../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import CheckboxField from '../../../gili/templates/CheckboxField';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import InputText from '../../../ui/InputText';
import TabList from '../../../ui/TabList';
import Transition from '../../../ui/Transition';
import {
  AiEditorCopyButton, AiEditorErrorMessage, AiEditorPreview, AiEditorResultArea,
} from './AiEditorShared';
import AiToneEditorModal from './AiToneEditorModal';

import sharedStyles from './AiEditorShared.module.scss';
import modalStyles from './AiMessageEditorModal.module.scss';
import styles from './AiTextStyleEditor.module.scss';

type OwnProps = {
  content?: AiEditorContent;
  customPrompt?: string;
  selectedTone?: ApiInputAiComposeTone;
  shouldEmojify?: boolean;
  isLoading?: boolean;
  result?: AiEditorResult;
  error?: 'floodPremium' | 'aiError' | 'generic';
  isPremium?: boolean;
  onGenerate: NoneToVoidFunction;
};

type StateProps = {
  tones: ApiAiComposeToneType[];
  isAiToneEditorOpen?: boolean;
};

const AiTextStyleEditor = ({
  content,
  customPrompt,
  selectedTone,
  shouldEmojify,
  isLoading,
  result,
  error,
  isPremium,
  tones,
  isAiToneEditorOpen,
  onGenerate,
}: OwnProps & StateProps) => {
  const {
    setAiMessageEditorStyleOptions,
    composeWithAiMessageEditor,
    openAiToneEditorModal,
    closeAiMessageEditorModal,
    deleteAiTone,
    openChatWithDraft,
  } = getActions();

  const lang = useLang();

  const [toneToDelete, setToneToDelete] = useState<ApiInputAiComposeTone>();
  const [isCreatorDelete, setIsCreatorDelete] = useState(false);

  const handleConfirmDelete = useLastCallback(() => {
    if (!toneToDelete) return;
    deleteAiTone({ tone: toneToDelete });
    setToneToDelete(undefined);
  });

  const handleCloseDeleteConfirm = useLastCallback(() => {
    setToneToDelete(undefined);
  });

  const hasSource = Boolean(content && hasAiEditorContent(content));
  const isPromptSelected = selectedTone?.type === 'singleUse';
  const hasRequest = Boolean(selectedTone) || shouldEmojify;
  const shouldShowError = Boolean(error) && hasRequest;

  const buildContextActions = useLastCallback((entry: ApiAiComposeToneType): MenuItemContextAction[] | undefined => {
    if (!('id' in entry)) return undefined;

    const tone = getInputTone(entry);
    const actions: MenuItemContextAction[] = [];

    if (entry.isCreator) {
      actions.push({
        title: lang('AiToneEditStyle'),
        icon: 'edit',
        handler: () => {
          openAiToneEditorModal({ toneToEdit: entry });
        },
      });
    }

    actions.push({
      title: lang('AiToneShareStyle'),
      icon: 'forward',
      handler: () => {
        closeAiMessageEditorModal();
        openChatWithDraft({ text: { text: `${TME_LINK_PREFIX}addstyle/${entry.slug}` } });
      },
    });

    actions.push({
      title: lang('AiToneDeleteStyle'),
      icon: 'delete',
      destructive: true,
      handler: () => {
        setToneToDelete(tone);
        setIsCreatorDelete(Boolean(entry.isCreator));
      },
    });

    return actions;
  });

  const styleTabs = useMemo((): TabWithProperties[] => {
    const tabs: TabWithProperties[] = [{ icon: 'ai', title: lang('AiEditorPrompt') }, ...tones.map((entry) => ({
      customEmojiDocumentId: entry.emojiId,
      title: entry.title,
      contextActions: buildContextActions(entry),
    }))];

    if (tones.length) {
      tabs.push({ icon: 'add', title: lang('AiToneEditorNewStyle') });
    }

    return tabs;
  }, [tones, lang, buildContextActions]);

  const toneIndex = tones.findIndex((entry) => compareAiTones(selectedTone, getInputTone(entry)));
  const activeStyleIndex = isPromptSelected ? 0 : toneIndex >= 0 ? toneIndex + 1 : -1;

  const handleStyleSelect = useLastCallback((index: number) => {
    if (index === 0) {
      if (isPromptSelected) return;
      setAiMessageEditorStyleOptions({
        selectedTone: { type: 'singleUse', customPrompt: customPrompt || '' }, clearResult: true,
      });
      return;
    }
    if (index === tones.length + 1) {
      openAiToneEditorModal();
      return;
    }
    if (!hasSource) return;
    const tone = getInputTone(tones[index - 1]);
    setAiMessageEditorStyleOptions({ selectedTone: tone });
    composeWithAiMessageEditor({ tone, isEmojify: shouldEmojify });
  });

  const handleEmojifyChange = useLastCallback((newEmojify: boolean) => {
    if (isPromptSelected || !hasSource || (!selectedTone && !newEmojify)) {
      setAiMessageEditorStyleOptions({ shouldEmojify: newEmojify, clearResult: true });
      return;
    }
    setAiMessageEditorStyleOptions({ shouldEmojify: newEmojify });
    composeWithAiMessageEditor({ tone: selectedTone, isEmojify: newEmojify });
  });

  const handlePromptChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const prompt = e.target.value;
    setAiMessageEditorStyleOptions({
      customPrompt: prompt,
      selectedTone: { type: 'singleUse', customPrompt: prompt },
      clearResult: true,
    });
  });

  const handlePromptKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.isComposing || e.repeat || result || error) return;
    e.preventDefault();
    onGenerate();
  });

  const displayContent = result || content;
  const showResultLabel = hasRequest || isLoading;
  const displayLabel = showResultLabel ? lang('AiMessageEditorResult') : lang('AiMessageEditorOriginal');

  const transitionKey = (activeStyleIndex >= 0 ? activeStyleIndex : 0) + (shouldEmojify ? styleTabs.length : 0);

  function renderPreviewText() {
    if (shouldShowError) {
      return (
        <AiEditorErrorMessage
          error={error}
          isPremium={isPremium}
          onRetry={isPromptSelected && !isLoading ? onGenerate : undefined}
        />
      );
    }

    return (
      <div className={styles.previewText}>
        <AiEditorPreview content={displayContent} />
      </div>
    );
  }

  return (
    <div className={buildClassName(modalStyles.editorBlock, hasSource && styles.styleBlock)}>
      {hasSource && (
        <>
          <div className={styles.tabListWrapper}>
            <TabList
              tabs={styleTabs}
              activeTab={activeStyleIndex}
              onSwitchTab={handleStyleSelect}
              className={styles.tabList}
              tabClassName={styles.tab}
              indicatorClassName={styles.tabListIndicator}
              itemAlignment="vertical"
            />
          </div>
          <div className={sharedStyles.separator} />
        </>
      )}

      {isPromptSelected && (
        <div className={styles.promptRow}>
          <InputText
            value={customPrompt}
            title={lang('AiEditorPrompt')}
            placeholder={lang(hasSource ? 'AiEditorRewritePlaceholder' : 'AiEditorGeneratePlaceholder')}
            onChange={handlePromptChange}
            onKeyDown={handlePromptKeyDown}
            noMargin
          />
        </div>
      )}

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
        content={displayContent}
        isHidden={isLoading || shouldShowError}
      />
      <AiToneEditorModal isOpen={Boolean(isAiToneEditorOpen)} />
      <ConfirmDialog
        isOpen={Boolean(toneToDelete)}
        title={lang('AiToneDeleteStyle')}
        text={lang(isCreatorDelete ? 'AiToneDeleteStyleConfirmOwn' : 'AiToneDeleteStyleConfirm')}
        confirmLabel={lang('Delete')}
        confirmIsDestructive
        onClose={handleCloseDeleteConfirm}
        confirmHandler={handleConfirmDelete}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      tones: global.aiComposeTones?.tones ?? MEMO_EMPTY_ARRAY,
      isAiToneEditorOpen: Boolean(selectTabState(global).aiToneEditorModal),
    };
  },
)(AiTextStyleEditor));
