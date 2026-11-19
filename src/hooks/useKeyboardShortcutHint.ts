import type { SharedSettings } from '../global/types';
import type { KeyboardShortcutId } from '../util/keyboardShortcuts/registry';

import { selectSharedSettings } from '../global/selectors/sharedState';
import { getKeyboardShortcutCombos } from '../util/keyboardShortcuts';
import { getKeyComboText } from '../util/keyboardShortcuts/keyCombos';
import useSelector from './data/useSelector';
import useLang from './useLang';

export default function useKeyboardShortcutHint(
  label: string,
  id?: KeyboardShortcutId,
  sendKeyCombo?: SharedSettings['messageSendKeyCombo'],
) {
  const lang = useLang();
  const settings = useSelector(selectSharedSettings);

  const combos = id ? getKeyboardShortcutCombos(id, {
    keyboardShortcuts: settings.keyboardShortcuts,
    messageSendKeyCombo: sendKeyCombo ?? settings.messageSendKeyCombo,
  }) : [];
  if (!combos.length) return label;

  return lang('ShortcutHint', {
    action: label,
    keys: lang.disjunction(combos.map(({ combo }) => getKeyComboText(combo, lang))),
  });
}
