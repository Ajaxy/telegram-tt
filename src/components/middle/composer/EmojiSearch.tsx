import {
  memo, useEffect, useRef,
} from '../../../lib/teact/teact';
import { toggleExtraClass } from '../../../lib/teact/teact-dom';

import type { ApiEmojiGroup } from '../../../api/types';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import useFlag from '../../../hooks/useFlag';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CustomEmoji from '../../common/CustomEmoji';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';

import styles from './EmojiSearch.module.scss';

type OwnProps = {
  value: string;
  groups?: ApiEmojiGroup[];
  activeGroup?: ApiEmojiGroup;
  placeholder?: string;
  isLoading?: boolean;
  hasBackButton?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onGroupSelect: (group?: ApiEmojiGroup) => void;
  onBackClick?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
};

const CHIP_ICON_SIZE = 26;

const EmojiSearch = ({
  value,
  groups,
  activeGroup,
  placeholder,
  isLoading,
  hasBackButton,
  className,
  onChange,
  onGroupSelect,
  onBackClick,
  onFocus,
  onBlur,
}: OwnProps) => {
  const inputRef = useRef<HTMLInputElement>();
  const chipsRef = useRef<HTMLDivElement>();

  const lang = useLang();

  const [isFocused, markFocused, unmarkFocused] = useFlag();

  const placeholderText = placeholder || lang('SearchEmoji');
  const hasText = Boolean(value.trim());
  const hasChips = Boolean(groups?.length);
  const isActive = Boolean(value || activeGroup || isFocused);

  useHorizontalScroll(chipsRef, !hasChips, true);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    return captureEscKeyListener(() => {
      onGroupSelect(undefined);
      onChange('');
      requestMutation(() => inputRef.current?.blur());
    });
  }, [isActive, onChange, onGroupSelect]);

  useEffect(() => {
    requestMeasure(() => {
      const chips = chipsRef.current;
      if (!chips) {
        return;
      }

      if (!activeGroup) {
        animateHorizontalScroll(chips, 0);
        return;
      }

      const activeChip = chips.querySelector<HTMLElement>(`.${styles.chipActive}`);
      if (!activeChip) {
        return;
      }

      const newLeft = activeChip.offsetLeft - chips.offsetWidth / 2 + activeChip.offsetWidth / 2;
      animateHorizontalScroll(chips, newLeft);
    });
  }, [activeGroup]);

  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
  });

  const handleFocus = useLastCallback(() => {
    markFocused();
    onFocus?.();
  });

  const handleBlur = useLastCallback(() => {
    unmarkFocused();
    onBlur?.();
  });

  const handleBackClick = useLastCallback(() => {
    if (hasBackButton) {
      onBackClick?.();
      return;
    }

    onGroupSelect(undefined);
  });

  const handleClearClick = useLastCallback(() => {
    onChange('');
    requestMutation(() => inputRef.current?.blur());
  });

  const handleChipClick = useLastCallback((group: ApiEmojiGroup) => {
    onGroupSelect(group === activeGroup ? undefined : group);
  });

  const handleChipKeyDown = useLastCallback((e: React.KeyboardEvent, group: ApiEmojiGroup) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleChipClick(group);
    }
  });

  const handleSurfaceClick = useLastCallback(() => {
    requestMutation(() => inputRef.current?.focus());
  });

  const handleChipsScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    const chips = e.currentTarget;
    const shouldMaskStart = Math.abs(chips.scrollLeft) > 1;
    requestMutation(() => {
      toggleExtraClass(chips, styles.chipsMaskStart, shouldMaskStart);
    });
  });

  return (
    <div className={buildClassName(styles.root, className)}>
      <div className={styles.iconContainer}>
        <Icon
          name="search"
          className={buildClassName(
            styles.leadingIcon,
            (activeGroup || isLoading || hasBackButton) && styles.iconHidden,
          )}
        />
        <Spinner
          className={buildClassName(styles.spinner, (!isLoading || activeGroup || hasBackButton) && styles.iconHidden)}
          color="gray"
        />
        <Icon
          name="arrow-left"
          className={buildClassName(
            styles.leadingIcon,
            styles.backIcon,
            !activeGroup && !hasBackButton && styles.iconHidden,
          )}
          role="button"
          ariaLabel={lang('AccDescrGoBack')}
          onClick={handleBackClick}
        />
      </div>
      <input
        ref={inputRef}
        type="text"
        dir="auto"
        className={styles.input}
        placeholder={hasChips ? undefined : placeholderText}
        aria-label={placeholderText}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <Button
        round
        size="tiny"
        color="translucent"
        className={buildClassName(styles.clearButton, !value && styles.iconHidden)}
        iconName="close"
        ariaLabel={lang('Clear')}
        tabIndex={value ? undefined : -1}
        onClick={handleClearClick}
      />
      {hasChips && (
        <div
          ref={chipsRef}
          className={buildClassName(
            styles.chips,
            'no-scrollbar',
            lang.isRtl && styles.chipsRtl,
            hasText && styles.chipsHidden,
          )}
          onScroll={handleChipsScroll}
        >
          <div className={styles.inputSurface} onClick={handleSurfaceClick}>
            {!hasText && placeholderText}
          </div>
          {groups.map((group) => (
            <div
              key={group.title}
              role="button"
              tabIndex={0}
              aria-label={group.title}
              className={buildClassName(styles.chip, group === activeGroup && styles.chipActive)}
              onClick={() => handleChipClick(group)}
              onKeyDown={(e) => handleChipKeyDown(e, group)}
            >
              <CustomEmoji
                documentId={group.iconEmojiId}
                size={CHIP_ICON_SIZE}
                isBig
                shouldNotLoop
                forceTextColor
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(EmojiSearch);
