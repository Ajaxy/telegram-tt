import { memo } from '../../../../lib/teact/teact';

import type { ResolvedKeyboardShortcutCombo } from '../../../../util/keyboardShortcuts';
import type { KeyComboModifier } from '../../../../util/keyboardShortcuts/keyCombos';
import type { LangFn } from '../../../../util/localization';

import buildClassName from '../../../../util/buildClassName';
import {
  getKeyComboLabels,
  getKeyLabel,
  getModifierLabels,
} from '../../../../util/keyboardShortcuts/keyCombos';

import useLang from '../../../../hooks/useLang';

import styles from './SettingsKeyboardShortcuts.module.scss';

type OwnProps = {
  combos?: ResolvedKeyboardShortcutCombo[];
  displayKeys?: string[];
  modifiers?: KeyComboModifier[];
  className?: string;
};

const MODIFIER_NAMES = new Set(['Mod', 'Ctrl', 'Alt', 'Shift', 'Meta']);

const KeyboardShortcutKeys = ({
  combos,
  displayKeys,
  modifiers,
  className,
}: OwnProps) => {
  const lang = useLang();

  const groups = displayKeys ? [getDisplayKeyLabels(displayKeys, lang)]
    : modifiers ? [getModifierLabels(modifiers)]
      : combos!.map(({ combo }) => getKeyComboLabels(combo, lang));

  return (
    <span className={buildClassName(styles.keys, className)} dir="ltr">
      {groups.map((labels, groupIndex) => (
        <span key={groupIndex} className={styles.combo} teactFastList>
          {labels.map((label) => (
            <kbd key={label} className={styles.key}><span className={styles.keyLabel}>{label}</span></kbd>
          ))}
          {groupIndex < groups.length - 1 && <span key="separator" className={styles.keysSeparator}>/</span>}
        </span>
      ))}
    </span>
  );
};

function getDisplayKeyLabels(displayKeys: string[], lang: LangFn) {
  const modifiers = displayKeys.filter((key) => MODIFIER_NAMES.has(key)) as (KeyComboModifier | 'Mod')[];
  const keys = displayKeys.filter((key) => !MODIFIER_NAMES.has(key));

  return [...getModifierLabels(modifiers), ...keys.map((key) => getKeyLabel(key, lang))];
}

export default memo(KeyboardShortcutKeys);
