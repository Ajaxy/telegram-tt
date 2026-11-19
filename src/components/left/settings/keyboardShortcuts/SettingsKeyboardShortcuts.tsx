import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../../../../lib/teact/teact-dom';
import { getActions, withGlobal } from '../../../../global';

import type { SharedSettings } from '../../../../global/types';
import type { KeyboardShortcutId } from '../../../../util/keyboardShortcuts/registry';
import type { IRadioOption } from '../../../ui/RadioGroup';
import type { RecordedComboCheck } from './helpers';

import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { selectSharedSettings } from '../../../../global/selectors/sharedState';
import buildClassName from '../../../../util/buildClassName';
import {
  getDefaultKeyboardShortcutCombos,
  getIsKeyboardShortcutAvailable,
  getKeyboardShortcutCombos,
} from '../../../../util/keyboardShortcuts';
import { getKeyComboText, IS_APPLE_KEYBOARD } from '../../../../util/keyboardShortcuts/keyCombos';
import {
  KEYBOARD_SHORTCUT_IDS,
  KEYBOARD_SHORTCUT_SECTIONS,
  KEYBOARD_SHORTCUTS,
} from '../../../../util/keyboardShortcuts/registry';
import {
  buildKeyboardShortcutCombos,
  buildKeyboardShortcutConflicts,
  checkRecordedCombo,
  filterKeyboardShortcuts,
  findEditableDefaultComboOwners,
} from './helpers';
import useKeyboardShortcutRecorder, { SHORTCUT_ROW_ATTRIBUTE } from './useKeyboardShortcutRecorder';

import useFlag from '../../../../hooks/useFlag';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import { getCenteredScrollTop, HIGHLIGHT_CLASS_NAME, HIGHLIGHT_DURATION } from '../hooks/useSettingsHighlight';

import NothingFound from '../../../common/NothingFound';
import Control, { ControlLabel } from '../../../gili/layout/Control';
import Interactive from '../../../gili/layout/Interactive';
import Island, { IslandDescription, IslandTitle } from '../../../gili/layout/Island';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import RadioGroup from '../../../ui/RadioGroup';
import SearchInput from '../../../ui/SearchInput';
import KeyboardShortcutReveal from './KeyboardShortcutReveal';
import KeyboardShortcutRow from './KeyboardShortcutRow';

import styles from './SettingsKeyboardShortcuts.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: NoneToVoidFunction;
};

type StateProps = Pick<SharedSettings, 'keyboardShortcuts' | 'messageSendKeyCombo'>;

type PendingReplace = {
  id: KeyboardShortcutId;
  ownerIds: KeyboardShortcutId[];
  combo?: string;
};

type RecordError = {
  id: KeyboardShortcutId;
  text: string;
};

const COMMAND_MODIFIER_LABELS = IS_APPLE_KEYBOARD ? ['⌘', '⌃', '⌥'] : ['Ctrl', 'Alt'];
const SECTIONS = KEYBOARD_SHORTCUT_SECTIONS.map((section) => ({
  ...section,
  ids: KEYBOARD_SHORTCUT_IDS.filter((id) => (
    KEYBOARD_SHORTCUTS[id].section === section.section && getIsKeyboardShortcutAvailable(id)
  )),
})).filter(({ ids }) => ids.length);

const SettingsKeyboardShortcuts = ({
  isActive,
  keyboardShortcuts,
  messageSendKeyCombo,
  onReset,
}: OwnProps & StateProps) => {
  const { setKeyboardShortcut, resetKeyboardShortcuts, setSharedSettingOption } = getActions();

  const lang = useLang();

  const containerRef = useRef<HTMLDivElement>();
  const highlightTimeoutRef = useRef<number>();
  const highlightedRowRef = useRef<HTMLElement>();
  const [query, setQuery] = useState('');
  const [pendingReplace, setPendingReplace] = useState<PendingReplace>();
  const [recordError, setRecordError] = useState<RecordError>();
  const [isResetAllDialogOpen, openResetAllDialog, closeResetAllDialog] = useFlag();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  useEffect(() => () => window.clearTimeout(highlightTimeoutRef.current), []);

  const combos = useMemo(() => (
    buildKeyboardShortcutCombos({ keyboardShortcuts, messageSendKeyCombo })
  ), [keyboardShortcuts, messageSendKeyCombo]);

  const conflicts = useMemo(() => buildKeyboardShortcutConflicts(combos), [combos]);

  const visibleIds = useMemo(() => new Set(filterKeyboardShortcuts(query, combos, lang)), [combos, lang, query]);
  const hasQuery = Boolean(query.trim());
  const hasVisibleRows = SECTIONS.some(({ ids }) => ids.some((id) => visibleIds.has(id)));

  const sendOptions: IRadioOption[] = useMemo(() => [{
    label: lang('SettingsSendEnter'),
    value: 'enter',
  }, {
    label: lang(IS_APPLE_KEYBOARD ? 'SettingsSendCmdenter' : 'SettingsSendCtrlenter'),
    value: 'ctrl-enter',
  }], [lang]);

  const hasCustomShortcuts = Object.keys(keyboardShortcuts).length > 0;

  const handleRecord = useLastCallback((id: KeyboardShortcutId, combo: string | false) => {
    const isUnchanged = combo === false
      ? !combos[id].length
      : combos[id].some((resolved) => resolved.combo === combo);
    if (isUnchanged) return;

    if (combo === false) {
      setKeyboardShortcut({ id, combo });
      return;
    }

    const [recorded] = getKeyboardShortcutCombos(id, { keyboardShortcuts: { [id]: combo }, messageSendKeyCombo });
    const check = checkRecordedCombo(id, recorded, combos);
    if (check.type === 'ok') {
      setKeyboardShortcut({ id, combo });
    } else if (check.type === 'usedByEditable') {
      requestReplace({ id, combo, ownerIds: check.ownerIds });
    } else {
      setRecordError({ id, text: getRecordErrorText(check, combo) });
    }
  });

  const {
    recordingId, recordingModifiers, startRecording,
  } = useKeyboardShortcutRecorder(isActive, handleRecord);

  const handleStartRecording = useLastCallback((id: KeyboardShortcutId) => {
    setRecordError(undefined);
    startRecording(id);
  });

  const handleResetShortcut = useLastCallback((id: KeyboardShortcutId) => {
    setRecordError(undefined);

    const ownerIds = findEditableDefaultComboOwners(
      id, getDefaultKeyboardShortcutCombos(id, messageSendKeyCombo), combos,
    );
    if (ownerIds.length) {
      requestReplace({ id, ownerIds });
      return;
    }

    resetKeyboardShortcuts({ id });
  });

  const handleConfirmReplace = useLastCallback(() => {
    const { id, ownerIds, combo } = pendingReplace!;
    ownerIds.forEach((ownerId) => {
      const ownerCombo = combos[ownerId].find((resolved) => !getIsComboTaken(resolved.combo, id, combo))?.combo;

      setKeyboardShortcut({ id: ownerId, combo: ownerCombo ?? false });
    });

    if (combo) {
      setKeyboardShortcut({ id, combo });
    } else {
      resetKeyboardShortcuts({ id });
    }

    setPendingReplace(undefined);
  });

  const handleCloseReplace = useLastCallback(() => {
    setPendingReplace(undefined);
  });

  const handleConfirmResetAll = useLastCallback(() => {
    resetKeyboardShortcuts();
    closeResetAllDialog();
  });

  const handleSendKeyComboChange = useLastCallback((value: string) => {
    setSharedSettingOption({ messageSendKeyCombo: value as SharedSettings['messageSendKeyCombo'] });
  });

  const handleQueryReset = useLastCallback(() => {
    setQuery('');
  });

  function getIsComboTaken(ownerCombo: string, id: KeyboardShortcutId, combo?: string) {
    const newCombos = combo ? [combo] : getDefaultKeyboardShortcutCombos(id, messageSendKeyCombo)
      .map((resolved) => resolved.combo);

    return newCombos.includes(ownerCombo);
  }

  function requestReplace(pending: PendingReplace) {
    setPendingReplace(pending);
    highlightRow(pending.ownerIds[0]);
  }

  function highlightRow(id: KeyboardShortcutId) {
    requestMeasure(() => {
      const container = containerRef.current;
      const row = container?.querySelector<HTMLElement>(`[${SHORTCUT_ROW_ATTRIBUTE}="${id}"]`);
      if (!container || !row) return;

      const scrollTop = getCenteredScrollTop(container, row);

      requestMutation(() => {
        container.scrollTop = scrollTop;
        if (highlightedRowRef.current) removeExtraClass(highlightedRowRef.current, HIGHLIGHT_CLASS_NAME);
        highlightedRowRef.current = row;
        addExtraClass(row, HIGHLIGHT_CLASS_NAME);

        window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = window.setTimeout(() => {
          highlightedRowRef.current = undefined;
          requestMutation(() => removeExtraClass(row, HIGHLIGHT_CLASS_NAME));
        }, HIGHLIGHT_DURATION);
      });
    });
  }

  function getRecordErrorText(check: RecordedComboCheck, combo: string) {
    switch (check.type) {
      case 'needsModifier':
        return lang('ShortcutNeedsModifier', { modifiers: lang.disjunction(COMMAND_MODIFIER_LABELS) });
      case 'reserved':
        return lang('ShortcutReserved', { keys: getKeyComboText(combo, lang) });
      case 'usedByFixed':
        return lang('ShortcutUsedByFixed', {
          keys: getKeyComboText(combo, lang),
          action: lang(KEYBOARD_SHORTCUTS[check.ownerId].titleKey),
        });
      default:
        return '';
    }
  }

  function renderReplaceText() {
    if (!pendingReplace) return undefined;

    const { id, ownerIds, combo } = pendingReplace;
    const keys = combo ? [combo] : getDefaultKeyboardShortcutCombos(id, messageSendKeyCombo)
      .map((resolved) => resolved.combo)
      .filter((defaultCombo) => ownerIds.some((ownerId) => (
        combos[ownerId].some((resolved) => resolved.combo === defaultCombo)
      )));

    return lang('ShortcutReplaceText', {
      keys: lang.disjunction(keys.map((key) => getKeyComboText(key, lang))),
      actions: lang.conjunction(ownerIds.map((ownerId) => lang(KEYBOARD_SHORTCUTS[ownerId].titleKey))),
    });
  }

  function renderRows(ids: KeyboardShortcutId[]) {
    return ids.map((id) => {
      const isRecording = recordingId === id;

      return (
        <KeyboardShortcutReveal key={id} isOpen={visibleIds.has(id)}>
          <KeyboardShortcutRow
            id={id}
            combos={combos[id]}
            conflictIds={conflicts[id]}
            isRecording={isRecording}
            recordingModifiers={isRecording ? recordingModifiers : undefined}
            error={recordError?.id === id ? recordError.text : undefined}
            isModified={keyboardShortcuts[id] !== undefined}
            onRecord={handleStartRecording}
            onReset={handleResetShortcut}
          />
        </KeyboardShortcutReveal>
      );
    });
  }

  return (
    <div ref={containerRef} className={buildClassName('settings-content', 'custom-scroll', styles.root)}>
      <SearchInput
        variant="island"
        value={query}
        placeholder={lang('Search')}
        autoComplete="off"
        onChange={setQuery}
        onReset={handleQueryReset}
      />

      {SECTIONS.map(({
        section, titleKey, descriptionKey, ids,
      }) => (
        <KeyboardShortcutReveal
          key={section}
          isOpen={ids.some((id) => visibleIds.has(id))}
          className={styles.section}
        >
          <div className={styles.sectionContent}>
            <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang(titleKey)}</IslandTitle>
            <Island>
              {section === 'sending' && (
                <KeyboardShortcutReveal isOpen={!hasQuery}>
                  <RadioGroup
                    name="keyboard-shortcuts-send"
                    options={sendOptions}
                    selected={messageSendKeyCombo}
                    onChange={handleSendKeyComboChange}
                  />
                </KeyboardShortcutReveal>
              )}
              {renderRows(ids)}
            </Island>
            {descriptionKey && (
              <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>{lang(descriptionKey)}</IslandDescription>
            )}
          </div>
        </KeyboardShortcutReveal>
      ))}

      <KeyboardShortcutReveal isOpen={!hasVisibleRows} className={styles.section}>
        <div className={styles.sectionContent}>
          <NothingFound className={styles.nothingFound} text={lang('NothingFound')} />
        </div>
      </KeyboardShortcutReveal>

      <KeyboardShortcutReveal isOpen={hasCustomShortcuts && !hasQuery} className={styles.section}>
        <div className={styles.sectionContent}>
          <Island>
            <Interactive clickable ripple onClick={openResetAllDialog}>
              <Control>
                <ControlLabel className={styles.destructive}>{lang('ShortcutResetAll')}</ControlLabel>
              </Control>
            </Interactive>
          </Island>
        </div>
      </KeyboardShortcutReveal>

      <ConfirmDialog
        isOpen={Boolean(pendingReplace)}
        title={lang('ShortcutReplaceTitle')}
        text={renderReplaceText()}
        confirmLabel={lang('Replace')}
        confirmHandler={handleConfirmReplace}
        onClose={handleCloseReplace}
      />
      <ConfirmDialog
        isOpen={isResetAllDialogOpen}
        title={lang('ShortcutResetAll')}
        text={lang('ShortcutResetAllText')}
        confirmLabel={lang('Reset')}
        confirmIsDestructive
        confirmHandler={handleConfirmResetAll}
        onClose={closeResetAllDialog}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { keyboardShortcuts, messageSendKeyCombo } = selectSharedSettings(global);

    return {
      keyboardShortcuts,
      messageSendKeyCombo,
    };
  },
)(SettingsKeyboardShortcuts));
