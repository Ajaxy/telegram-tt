import { useEffect, useState } from '../../../../lib/teact/teact';

import type { KeyComboModifier } from '../../../../util/keyboardShortcuts/keyCombos';
import type { KeyboardShortcutId } from '../../../../util/keyboardShortcuts/registry';

import { getEventModifiers, getKeyComboFromEvent } from '../../../../util/keyboardShortcuts/keyCombos';

import useLastCallback from '../../../../hooks/useLastCallback';

export const SHORTCUT_ROW_ATTRIBUTE = 'data-shortcut-id';

const NO_MODIFIERS: KeyComboModifier[] = [];
const CLEAR_KEYS = new Set(['Backspace', 'Delete']);

export default function useKeyboardShortcutRecorder(
  isActive: boolean | undefined,
  onRecord: (id: KeyboardShortcutId, combo: string | false) => void,
) {
  const [recordingId, setRecordingId] = useState<KeyboardShortcutId>();
  const [modifiers, setModifiers] = useState(NO_MODIFIERS);

  const stopRecording = useLastCallback(() => {
    setRecordingId(undefined);
    setModifiers(NO_MODIFIERS);
  });

  const finishRecording = useLastCallback((combo: string | false) => {
    const id = recordingId!;
    stopRecording();
    onRecord(id, combo);
  });

  useEffect(() => {
    if (!isActive) stopRecording();
  }, [isActive]);

  useEffect(() => {
    if (!recordingId) return undefined;

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || e.isComposing) return;

      const combo = getKeyComboFromEvent(e);
      if (!combo) {
        setModifiers(getEventModifiers(e));
        return;
      }

      if (combo === 'Escape') {
        stopRecording();
      } else if (CLEAR_KEYS.has(combo)) {
        finishRecording(false);
      } else {
        finishRecording(combo);
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setModifiers(getEventModifiers(e));
    }

    function handlePointerDown(e: PointerEvent) {
      const row = (e.target as Element).closest(`[${SHORTCUT_ROW_ATTRIBUTE}="${recordingId}"]`);
      if (!row) stopRecording();
    }

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', stopRecording);
    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', stopRecording);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [recordingId]);

  return {
    recordingId,
    recordingModifiers: modifiers,
    startRecording: setRecordingId,
  };
}
