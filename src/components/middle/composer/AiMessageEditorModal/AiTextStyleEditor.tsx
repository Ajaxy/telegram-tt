import { memo, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiAiComposeToneType, ApiComposedMessageWithAI, ApiFormattedText, ApiInputAiComposeTone,
} from '../../../../api/types';
import type { MenuItemContextAction } from '../../../ui/ListItem';
import type { TabWithProperties } from '../../../ui/TabList';

import { TME_LINK_PREFIX } from '../../../../config';
import { selectTabState } from '../../../../global/selectors';
import { compareAiTones, getInputTone } from '../../../../util/aiComposeTones';
import buildClassName from '../../../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import CheckboxField from '../../../gili/templates/CheckboxField';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import Skeleton from '../../../ui/placeholder/Skeleton';
import TabList from '../../../ui/TabList';
import Transition from '../../../ui/Transition';
import { AiEditorCopyButton, AiEditorErrorMessage, AiEditorResultArea } from './AiEditorShared';
import AiToneEditorModal from './AiToneEditorModal';

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
  isAiToneEditorOpen?: boolean;
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
  isAiToneEditorOpen,
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

  const hasResult = Boolean(result?.resultText);
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
    const tabs: TabWithProperties[] = tones.map((entry) => ({
      customEmojiDocumentId: entry.emojiId,
      title: entry.title,
      contextActions: buildContextActions(entry),
    }));

    if (tones.length) {
      tabs.push({ icon: 'add', title: lang('AiToneEditorNewStyle') });
    }

    return tabs;
  }, [tones, lang, buildContextActions]);

  const activeStyleIndex = tones.findIndex(
    (entry) => compareAiTones(selectedTone, getInputTone(entry)),
  );

  const handleStyleSelect = useLastCallback((index: number) => {
    if (index === tones.length) {
      openAiToneEditorModal();
      return;
    }
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
      <div className={styles.tabListWrapper}>
        {styleTabs.length > 0 && (
          <TabList
            tabs={styleTabs}
            activeTab={activeStyleIndex}
            onSwitchTab={handleStyleSelect}
            className={styles.tabList}
            tabClassName={styles.tab}
            indicatorClassName={styles.tabListIndicator}
            itemAlignment="vertical"
          />
        )}
        <div className={buildClassName(styles.tabListSkeleton, styleTabs.length && styles.tabListSkeletonHidden)}>
          <Skeleton className={styles.tabSkeleton} variant="round" animation="wave" />
          <Skeleton className={styles.tabSkeleton} variant="round" animation="wave" />
          <Skeleton className={styles.tabSkeleton} variant="round" animation="wave" />
          <Skeleton className={styles.tabSkeleton} variant="round" animation="wave" />
          <Skeleton className={styles.tabSkeleton} variant="round" animation="wave" />
        </div>
      </div>

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
