import type { TeactNode } from '../../../lib/teact/teact';
import { memo, useMemo, useState } from '../../../lib/teact/teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { BIP39_WORD_INDEXES } from '../../../lib/ton/bip39Wordlist';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import TabList from '../../ui/TabList';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';
import WalletPhraseWordInput, { getPhraseWordInputId } from './WalletPhraseWordInput';
import Island from '@gili/layout/Island';

import styles from './WalletEnterPhraseScreen.module.scss';

type OwnProps = {
  title?: string;
  subtitle: TeactNode;
  initialWords?: string[];
  isLoading?: boolean;
  error?: string;
  onSubmit: (words: string[]) => void;
  onClearError: NoneToVoidFunction;
};

const SHORT_PHRASE_LENGTH = 12;
const LONG_PHRASE_LENGTH = 24;
const PHRASE_LENGTHS = [SHORT_PHRASE_LENGTH, LONG_PHRASE_LENGTH];
const WORD_SEPARATOR_REGEX = /\s+/;
const CAN_READ_CLIPBOARD = Boolean(window.navigator.clipboard?.readText);

const WalletEnterPhraseScreen = ({
  title, subtitle, initialWords, isLoading, error, onSubmit, onClearError,
}: OwnProps) => {
  const lang = useLang();

  const [wordCount, setWordCount] = useState(
    initialWords?.length === LONG_PHRASE_LENGTH ? LONG_PHRASE_LENGTH : SHORT_PHRASE_LENGTH,
  );
  const [words, setWords] = useState<string[]>(
    () => Array.from({ length: LONG_PHRASE_LENGTH }, (_, index) => initialWords?.[index] || ''),
  );

  const phrase = words.slice(0, wordCount);
  const lengthTabs = useMemo(() => ([
    { title: lang('WalletPhrase12Words') },
    { title: lang('WalletPhrase24Words') },
  ]), [lang]);
  const canSubmit = phrase.every((word) => BIP39_WORD_INDEXES.has(word));

  // A suggestion pick and typing into the next word can land within one frame
  const updateWords = useLastCallback((update: (current: string[]) => string[]) => {
    setWords(update);
    onClearError();
  });

  const handleWordChange = useLastCallback((index: number, value: string) => {
    updateWords((current) => {
      const updated = [...current];
      updated[index] = value;

      return updated;
    });
  });

  const handleWords = useLastCallback((index: number, pasted: string[]) => {
    const isWholePhrase = PHRASE_LENGTHS.includes(pasted.length);
    const start = isWholePhrase ? 0 : index;

    updateWords((current) => {
      const updated = [...current];

      pasted.slice(0, LONG_PHRASE_LENGTH - start).forEach((word, offset) => {
        updated[start + offset] = word;
      });

      return updated;
    });

    if (isWholePhrase) {
      setWordCount(pasted.length);

      requestMutation(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      });
    } else {
      // Typing on after a space continues in the last word filled
      const filled = Math.min(pasted.length, LONG_PHRASE_LENGTH - start);
      const last = document.getElementById(getPhraseWordInputId(start + filled - 1)) as HTMLInputElement | null;

      if (last) {
        requestMutation(() => {
          last.value = pasted[filled - 1];
          last.focus();
        });
      }
    }
  });

  const handlePasteClick = useLastCallback(async () => {
    const text = await window.navigator.clipboard.readText().catch(() => '');
    const pasted = text.trim().toLowerCase().split(WORD_SEPARATOR_REGEX).filter(Boolean);

    if (pasted.length) {
      handleWords(0, pasted);
    }
  });

  const handleSwitchLength = useLastCallback((index: number) => {
    setWordCount(PHRASE_LENGTHS[index]);
    onClearError();
  });

  const handleSubmit = useLastCallback(() => {
    if (canSubmit && !isLoading) {
      onSubmit(phrase);
    }
  });

  return (
    <WalletNoticeScreen sticker="🔑" title={title || lang('WalletEnterPhraseTitle')} text={subtitle}>
      {CAN_READ_CLIPBOARD && (
        <Button isText size="tiny" className={styles.paste} onClick={handlePasteClick}>
          <Icon name="paste" className={styles.pasteIcon} />
          {lang('WalletPastePhrase')}
        </Button>
      )}
      <Island>
        <TabList
          tabs={lengthTabs}
          activeTab={PHRASE_LENGTHS.indexOf(wordCount)}
          className={styles.tabs}
          centered
          onSwitchTab={handleSwitchLength}
        />
        <div className={buildClassName(styles.words, wordCount === LONG_PHRASE_LENGTH && styles.long)}>
          {phrase.map((word, index) => (
            <WalletPhraseWordInput
              key={index}
              index={index}
              value={word}
              isLast={index === wordCount - 1}
              onChange={handleWordChange}
              onWords={handleWords}
              onSubmit={handleSubmit}
            />
          ))}
        </div>
      </Island>
      {error && <div className={styles.error} role="alert">{renderText(error, ['br'])}</div>}
      <WalletNoticeActions>
        <Button
          pill
          disabled={!canSubmit || isLoading}
          isLoading={isLoading}
          onClick={handleSubmit}
        >
          {lang('Continue')}
        </Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(WalletEnterPhraseScreen);
