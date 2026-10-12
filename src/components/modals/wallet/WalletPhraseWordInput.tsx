import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { BIP39_WORD_INDEXES, BIP39_WORDLIST } from '../../../lib/ton/bip39Wordlist';
import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';

import styles from './WalletPhraseWordInput.module.scss';

type OwnProps = {
  index: number;
  value: string;
  isLast?: boolean;
  onChange: (index: number, value: string) => void;
  onWords: (index: number, words: string[]) => void;
  onSubmit: NoneToVoidFunction;
};

const SUGGESTIONS_LIMIT = 5;
const WORD_SEPARATOR_REGEX = /\s+/;
const NO_ACTIVE_SUGGESTION = -1;
// Matches the gap in the stylesheet
const SUGGESTIONS_GAP_PX = 4;

type Placement = 'top' | 'bottom';

export function getPhraseWordInputId(index: number) {
  return `wallet-phrase-word-${index}`;
}

const WalletPhraseWordInput = ({
  index, value, isLast, onChange, onWords, onSubmit,
}: OwnProps) => {
  const rootRef = useRef<HTMLDivElement>();
  const listRef = useRef<HTMLDivElement>();
  const [isFocused, markFocused, unmarkFocused] = useFlag();
  const [activeIndex, setActiveIndex] = useState(NO_ACTIVE_SUGGESTION);
  const [placement, setPlacement] = useState<Placement | undefined>();

  const suggestions = useMemo(() => {
    if (!isFocused || !value) return [];

    return BIP39_WORDLIST.filter((word) => word.startsWith(value)).slice(0, SUGGESTIONS_LIMIT);
  }, [isFocused, value]);
  const isKnownWord = BIP39_WORD_INDEXES.has(value);
  const isInvalid = Boolean(value) && !isKnownWord && (!isFocused || !suggestions.length);
  const shouldShowSuggestions = suggestions.length > 1 || (suggestions.length === 1 && suggestions[0] !== value);

  useEffect(() => {
    if (!shouldShowSuggestions) {
      setPlacement(undefined);
      return;
    }

    requestMeasure(() => {
      const root = rootRef.current;
      const list = listRef.current;
      if (!root || !list) return;

      // The slide is the scroll container, marked `custom-scroll`
      const scrollParent = root.closest('.custom-scroll')!;
      const limit = Math.min(window.innerHeight, scrollParent.getBoundingClientRect().bottom);
      const isOverflowing = root.getBoundingClientRect().bottom + SUGGESTIONS_GAP_PX + list.offsetHeight > limit;
      setPlacement(isOverflowing ? 'top' : 'bottom');
    });
  }, [shouldShowSuggestions, suggestions.length]);

  const focusNext = useLastCallback(() => {
    if (isLast) return;

    const next = document.getElementById(getPhraseWordInputId(index + 1)) as HTMLInputElement | null;
    if (!next) return;

    // Focus may scroll, so it waits for the mutation phase
    requestMutation(() => {
      next.focus();
      next.select();
    });
  });

  const pick = useLastCallback((word: string) => {
    onChange(index, word);
    setActiveIndex(NO_ACTIVE_SUGGESTION);
    focusNext();
  });

  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const words = e.currentTarget.value.trim().toLowerCase().split(WORD_SEPARATOR_REGEX).filter(Boolean);
    setActiveIndex(NO_ACTIVE_SUGGESTION);

    if (words.length > 1) {
      onWords(index, words);
      return;
    }

    onChange(index, words[0] || '');
  });

  const handlePaste = useLastCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const words = e.clipboardData.getData('text').trim().toLowerCase().split(WORD_SEPARATOR_REGEX).filter(Boolean);
    if (words.length <= 1) return;

    e.preventDefault();
    onWords(index, words);
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!shouldShowSuggestions) return;

      e.preventDefault();

      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((activeIndex + step + suggestions.length) % suggestions.length);
      return;
    }

    if (e.key !== 'Enter' && !(e.key === 'Tab' && !e.shiftKey)) return;

    if (shouldShowSuggestions) {
      e.preventDefault();
      pick(suggestions[Math.max(activeIndex, 0)]);
      return;
    }

    if (e.key === 'Enter') {
      if (isLast) {
        onSubmit();
      } else {
        focusNext();
      }
    }
  });

  const handleSuggestionMouseDown = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Keeps the input focused, so the list does not close before the click lands
    e.preventDefault();
    pick(e.currentTarget.dataset.word!);
  });

  const handleBlur = useLastCallback(() => {
    unmarkFocused();
    setActiveIndex(NO_ACTIVE_SUGGESTION);
  });

  return (
    <div
      ref={rootRef}
      className={buildClassName(styles.root, isFocused && styles.focused, isInvalid && styles.invalid)}
    >
      <label className={styles.number} htmlFor={getPhraseWordInputId(index)}>{`${index + 1}.`}</label>
      <input
        id={getPhraseWordInputId(index)}
        className={styles.input}
        type="text"
        value={value}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={markFocused}
        onBlur={handleBlur}
      />
      {shouldShowSuggestions && (
        <div
          ref={listRef}
          className={buildClassName(styles.suggestions, placement && styles[placement])}
          role="listbox"
        >
          {suggestions.map((word, suggestionIndex) => (
            <div
              key={word}
              role="option"
              aria-selected={suggestionIndex === activeIndex}
              className={buildClassName(styles.suggestion, suggestionIndex === activeIndex && styles.active)}
              data-word={word}
              onMouseDown={handleSuggestionMouseDown}
            >
              {word}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(WalletPhraseWordInput);
