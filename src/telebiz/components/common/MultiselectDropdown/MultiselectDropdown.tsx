import { memo, useMemo, useRef, useState } from '../../../../lib/teact/teact';

import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../../components/common/icons/Icon';
import Checkbox from '../../../../components/ui/Checkbox';
import Menu from '../../../../components/ui/Menu';

import styles from './MultiselectDropdown.module.scss';

const SEARCH_THRESHOLD = 5;

export type MultiselectOption = {
  label: string;
  value: string;
};

type OwnProps = {
  id: string;
  label: string;
  options: MultiselectOption[];
  selected: string[];
  placeholder?: string;
  className?: string;
  onChange: (values: string[]) => void;
};

const MultiselectDropdown = ({
  id,
  label,
  options,
  selected,
  placeholder,
  className,
  onChange,
}: OwnProps) => {
  const triggerRef = useRef<HTMLDivElement>();
  const inputRef = useRef<HTMLInputElement>();
  const [isOpen, openMenu, closeMenu] = useFlag(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<string>();

  const hasSearch = options.length > SEARCH_THRESHOLD;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;

    const query = searchQuery.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const handleTriggerClick = useLastCallback(() => {
    if (isOpen) {
      closeMenu();
    } else {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuStyle(`left: ${rect.left}px; top: ${rect.bottom + 4}px; width: ${rect.width}px;`);
      }
      openMenu();
      setSearchQuery('');
      // Focus search input after menu opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  });

  const handleOptionChange = useLastCallback((value: string, isChecked: boolean) => {
    if (isChecked) {
      onChange([...selected, value]);
    } else {
      onChange(selected.filter((v) => v !== value));
    }
  });

  const handleSearchChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  });

  const handleSearchKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent menu keyboard navigation while typing
    e.stopPropagation();
  });

  const selectedLabels = useMemo(() => {
    return options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label);
  }, [options, selected]);

  const displayText = selectedLabels.length > 0
    ? selectedLabels.join(', ')
    : '';

  const hasValue = selectedLabels.length > 0;

  return (
    <div
      ref={triggerRef}
      className={buildClassName(
        'input-group',
        hasValue && 'touched',
        label && 'with-label',
        'with-arrow',
        className,
      )}
      onClick={handleTriggerClick}
      role="button"
      tabIndex={0}
    >
      <div className={buildClassName('form-control', styles.trigger, isOpen && styles.triggerOpen)}>
        {displayText || placeholder}
      </div>
      {label && <label htmlFor={id}>{label}</label>}

      <Menu
        isOpen={isOpen}
        id={id}
        className={styles.menu}
        bubbleClassName={styles.menuBubble}
        style={menuStyle}
        positionX="left"
        positionY="top"
        autoClose={false}
        withPortal
        onClose={closeMenu}
      >
        {hasSearch && (
          <div className={styles.searchContainer}>
            <Icon name="search" className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
        )}
        <div className={styles.optionsList}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <Checkbox
                key={option.value}
                className={styles.option}
                label={option.label}
                value={option.value}
                checked={selected.includes(option.value)}
                onCheck={(checked) => handleOptionChange(option.value, checked)}
              />
            ))
          ) : (
            <div className={styles.noResults}>No results found</div>
          )}
        </div>
      </Menu>
    </div>
  );
};

export default memo(MultiselectDropdown);
