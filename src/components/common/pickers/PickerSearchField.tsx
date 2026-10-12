import type { ElementRef } from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { CustomPeer } from '../../../types';

import { selectCanAnimateInterface } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import { useStateRef } from '../../../hooks/useStateRef';
import useSyncEffect from '../../../hooks/useSyncEffect';

import Icon from '../icons/Icon';
import PeerChip from '../PeerChip';

import styles from './PickerSearchField.module.scss';

export type PickerSearchChip = {
  key: string;
  peerId?: string;
  customPeer?: CustomPeer;
  title?: string;
  isMinimized?: boolean;
  forceShowSelf?: boolean;
  canClose?: boolean;
};

type OwnProps = {
  inputRef?: ElementRef<HTMLInputElement>;
  value?: string;
  placeholder: string;
  inputId?: string;
  chips?: PickerSearchChip[];
  className?: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onChipClick?: (key: string) => void;
};

type RemovingChip = {
  chip: PickerSearchChip;
  index: number;
};

const APPEAR_ANIMATION_MS = 200;
const DISAPPEAR_ANIMATION_MS = 300;

const PickerSearchField = ({
  inputRef,
  value,
  placeholder,
  inputId,
  chips,
  className,
  onChange,
  onKeyDown,
  onChipClick,
}: OwnProps) => {
  const lang = useLang();

  // Removed chips are kept at their previous position for the duration of the disappear animation
  const [removingChips, setRemovingChips] = useState<RemovingChip[]>([]);
  const [appearingKeys, setAppearingKeys] = useState<string[]>([]);
  const removingChipsRef = useStateRef(removingChips);
  const appearingKeysRef = useStateRef(appearingKeys);
  const timeoutsRef = useRef<Set<number>>(new Set());

  const scheduleTimeout = useLastCallback((callback: NoneToVoidFunction, ms: number) => {
    const timeoutId = window.setTimeout(() => {
      timeoutsRef.current.delete(timeoutId);
      callback();
    }, ms);
    timeoutsRef.current.add(timeoutId);
  });

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach(window.clearTimeout);
      timeouts.clear();
    };
  }, []);

  useSyncEffect(([prevChips]) => {
    if (prevChips === undefined || chips === prevChips) {
      return;
    }

    const prevByKey = new Map((prevChips || []).map((chip) => [chip.key, chip]));
    const currentKeys = new Set((chips || []).map((chip) => chip.key));

    const addedKeys = (chips || []).filter((chip) => !prevByKey.has(chip.key)).map((chip) => chip.key);
    const removed = (prevChips || [])
      .map((chip, index) => ({ chip, index }))
      .filter(({ chip }) => !currentKeys.has(chip.key));

    if (addedKeys.length && removingChipsRef.current.length) {
      setRemovingChips(removingChipsRef.current.filter(({ chip }) => !addedKeys.includes(chip.key)));
    }

    if (!selectCanAnimateInterface(getGlobal())) {
      return;
    }

    if (addedKeys.length) {
      setAppearingKeys([...appearingKeysRef.current, ...addedKeys]);
      scheduleTimeout(() => {
        setAppearingKeys(appearingKeysRef.current.filter((key) => !addedKeys.includes(key)));
      }, APPEAR_ANIMATION_MS);
    }

    if (removed.length) {
      const removedKeys = removed.map(({ chip }) => chip.key);
      setRemovingChips([
        ...removingChipsRef.current.filter(({ chip }) => !removedKeys.includes(chip.key)),
        ...removed,
      ]);
      scheduleTimeout(() => {
        setRemovingChips(removingChipsRef.current.filter(({ chip }) => !removedKeys.includes(chip.key)));
      }, DISAPPEAR_ANIMATION_MS);
    }
  }, [chips, appearingKeysRef, removingChipsRef]);

  const renderedChips = useMemo(() => {
    const current: { chip: PickerSearchChip; isRemoving?: boolean }[] = (chips || []).map((chip) => ({ chip }));
    if (!removingChips.length) return current;

    removingChips.forEach(({ chip, index }) => {
      current.splice(Math.min(index, current.length), 0, { chip, isRemoving: true });
    });
    return current;
  }, [chips, removingChips]);

  const handleInputChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
  });

  const hasChips = Boolean(renderedChips.length);

  return (
    <div
      className={buildClassName(styles.root, 'no-scrollbar', className)}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      <div className={styles.chipsList}>
        {renderedChips.map(({ chip, isRemoving }) => (
          <div
            key={chip.key}
            className={buildClassName(
              styles.chipWrapper,
              appearingKeys.includes(chip.key) && styles.chipAppear,
              isRemoving && styles.chipDisappear,
            )}
          >
            <PeerChip
              peerId={chip.peerId}
              customPeer={chip.customPeer}
              title={chip.title}
              isMinimized={chip.isMinimized}
              forceShowSelf={chip.forceShowSelf}
              size="small"
              canClose={chip.canClose}
              className={styles.chip}
              itemClassName={styles.chipName}
              clickArg={chip.key}
              onClick={onChipClick}
            />
          </div>
        ))}
      </div>
      <div className={styles.inlineSearch}>
        <Icon name="search" className={buildClassName(styles.searchIcon, hasChips && styles.searchIconInline)} />
        <input
          ref={inputRef}
          id={inputId}
          className={styles.input}
          type="text"
          dir="auto"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
};

export default memo(PickerSearchField);
