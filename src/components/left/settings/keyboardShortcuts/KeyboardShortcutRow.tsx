import { memo, useRef } from '../../../../lib/teact/teact';

import type { ResolvedKeyboardShortcutCombo } from '../../../../util/keyboardShortcuts';
import type { KeyComboModifier } from '../../../../util/keyboardShortcuts/keyCombos';
import type { KeyboardShortcutId } from '../../../../util/keyboardShortcuts/registry';

import buildClassName from '../../../../util/buildClassName';
import { getKeyComboText } from '../../../../util/keyboardShortcuts/keyCombos';
import { KEYBOARD_SHORTCUTS } from '../../../../util/keyboardShortcuts/registry';
import { getConditionTitleKey } from './helpers';

import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../common/icons/Icon';
import Control, { ControlAfter, ControlDescription, ControlLabel } from '../../../gili/layout/Control';
import Interactive from '../../../gili/layout/Interactive';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';
import KeyboardShortcutCrossfade from './KeyboardShortcutCrossfade';
import KeyboardShortcutKeys from './KeyboardShortcutKeys';
import KeyboardShortcutReveal from './KeyboardShortcutReveal';

import styles from './SettingsKeyboardShortcuts.module.scss';

type OwnProps = {
  id: KeyboardShortcutId;
  combos: ResolvedKeyboardShortcutCombo[];
  conflictIds?: KeyboardShortcutId[];
  isRecording?: boolean;
  recordingModifiers?: KeyComboModifier[];
  error?: string;
  isModified?: boolean;
  onRecord: (id: KeyboardShortcutId) => void;
  onReset: (id: KeyboardShortcutId) => void;
};

const KeyboardShortcutRow = ({
  id,
  combos,
  conflictIds,
  isRecording,
  recordingModifiers,
  error,
  isModified,
  onRecord,
  onReset,
}: OwnProps) => {
  const lang = useLang();

  const ref = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();

  const {
    titleKey, descriptionKey, condition, isEditable, defaults, displayKeys,
  } = KEYBOARD_SHORTCUTS[id];
  const isFixed = !isEditable && !defaults.some(({ sendKeyCombo }) => sendKeyCombo);

  const {
    isContextMenuOpen, contextMenuAnchor, handleContextMenu, handleBeforeContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, !isModified || isRecording);

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.detail) e.currentTarget.blur();
    onRecord(id);
  });

  const handleResetClick = useLastCallback(() => {
    onReset(id);
  });

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!.closest('.custom-scroll'));
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  function renderDescription() {
    const comboConditionLines = combos
      .filter((resolved) => resolved.condition && resolved.condition !== condition)
      .map((resolved) => {
        const conditionTitle = lang(getConditionTitleKey(resolved.condition!));
        if (combos.length === 1) return conditionTitle;

        return lang('ShortcutComboCondition', {
          keys: getKeyComboText(resolved.combo, lang),
          condition: conditionTitle,
        });
      });
    const conflictTitles = conflictIds?.map((conflictId) => lang(KEYBOARD_SHORTCUTS[conflictId].titleKey));

    return (
      <ControlDescription className={styles.description}>
        {(condition || descriptionKey) && (
          <span className={styles.descriptionBlock}>
            {condition && <span className={styles.descriptionLine}>{lang(getConditionTitleKey(condition))}</span>}
            {descriptionKey && <span className={styles.descriptionLine}>{lang(descriptionKey)}</span>}
          </span>
        )}
        <KeyboardShortcutReveal isOpen={comboConditionLines.length > 0}>
          <span className={styles.descriptionBlock}>
            {comboConditionLines.map((line) => (
              <span key={line} className={styles.descriptionLine}>{line}</span>
            ))}
          </span>
        </KeyboardShortcutReveal>
        <KeyboardShortcutReveal isOpen={Boolean(error)}>
          <span className={buildClassName(styles.descriptionBlock, styles.error)}>{error}</span>
        </KeyboardShortcutReveal>
        <KeyboardShortcutReveal isOpen={Boolean(isRecording && !error)}>
          <span className={styles.descriptionBlock}>{lang('ShortcutRecordingHint')}</span>
        </KeyboardShortcutReveal>
        <KeyboardShortcutReveal isOpen={Boolean(conflictTitles) && !isRecording && !error}>
          <span className={buildClassName(styles.descriptionBlock, styles.conflict)}>
            <Icon name="warning" className={styles.conflictIcon} />
            {conflictTitles && lang('ShortcutAlsoUsedBy', { action: lang.conjunction(conflictTitles) })}
          </span>
        </KeyboardShortcutReveal>
      </ControlDescription>
    );
  }

  function getKeysContentKey() {
    if (isRecording) return recordingModifiers?.length ? 'recordingKeys' : 'recording';
    if (displayKeys || combos.length) return combos.map(({ combo }) => combo).join(' ') || 'displayKeys';

    return 'notSet';
  }

  function renderKeys() {
    if (isRecording) {
      return recordingModifiers?.length ? (
        <KeyboardShortcutKeys modifiers={recordingModifiers} className={styles.recordingKeys} />
      ) : (
        <span className={styles.recordingText}>{lang('ShortcutRecording')}</span>
      );
    }

    if (displayKeys || combos.length) {
      return <KeyboardShortcutKeys combos={combos} displayKeys={displayKeys} />;
    }

    return <span className={styles.notSet}>{lang('ShortcutNotSet')}</span>;
  }

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.row,
        isRecording && styles.recording,
      )}
      data-shortcut-id={id}
      data-settings-anchor={titleKey}
      onMouseDown={handleBeforeContextMenu}
      onContextMenu={handleContextMenu}
    >
      <Interactive
        clickable={isEditable}
        ripple={isEditable}
        className={styles.interactive}
        onClick={isEditable ? handleClick : undefined}
      >
        <Control className={styles.control}>
          <ControlLabel>{lang(titleKey)}</ControlLabel>
          {renderDescription()}
          <ControlAfter className={styles.after}>
            {isFixed && <Icon name="lock-filled" className={styles.fixedIcon} />}
            <KeyboardShortcutCrossfade contentKey={getKeysContentKey()}>
              {renderKeys()}
            </KeyboardShortcutCrossfade>
          </ControlAfter>
        </Control>
      </Interactive>
      {contextMenuAnchor !== undefined && (
        <Menu
          ref={menuRef}
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="with-menu-transitions"
          autoClose
          withPortal
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        >
          <MenuItem icon="undo" onClick={handleResetClick}>{lang('ThemeResetToDefaults')}</MenuItem>
        </Menu>
      )}
    </div>
  );
};

export default memo(KeyboardShortcutRow);
