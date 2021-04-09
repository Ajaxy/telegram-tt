import React, {
  FC, useState, memo, useCallback, useRef,
} from '../../lib/teact/teact';

import { countryList } from '../../util/phoneNumber';
import searchWords from '../../util/searchWords';
import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import Spinner from '../ui/Spinner';

import './CountryCodeInput.scss';
import { ANIMATION_END_DELAY } from '../../config';

type OwnProps = {
  id: string;
  value?: Country;
  isLoading?: boolean;
  onChange: (value: Country) => void;
};

const MENU_HIDING_DURATION = 200 + ANIMATION_END_DELAY;
const SELECT_TIMEOUT = 50;

const CountryCodeInput: FC<OwnProps> = ({
  id,
  value,
  isLoading,
  onChange,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<string | undefined>();
  const [filteredList, setFilteredList] = useState(countryList);

  function updateFilter(filterValue?: string) {
    setFilter(filterValue);
    setFilteredList(getFilteredList(filterValue));
  }

  const handleChange = useCallback((e: React.SyntheticEvent<HTMLElement>) => {
    const { countryId } = (e.currentTarget.firstElementChild as HTMLDivElement).dataset;
    const country = countryList.find((c) => c.id === countryId);

    if (country) {
      onChange(country);
    }

    setTimeout(() => updateFilter(undefined), MENU_HIDING_DURATION);
  }, [onChange]);

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    updateFilter(e.currentTarget.value);
  }, []);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode !== 8) {
      return;
    }

    const target = e.currentTarget;
    if (value && filter === undefined) {
      target.value = '';
    }

    updateFilter(target.value);
  }, [filter, value]);

  const CodeInput: FC<{ onTrigger: () => void; isOpen?: boolean }> = ({ onTrigger, isOpen }) => {
    const handleTrigger = () => {
      if (isOpen) {
        return;
      }

      setTimeout(() => {
        inputRef.current!.select();
      }, SELECT_TIMEOUT);

      onTrigger();

      const formEl = document.getElementById('auth-phone-number-form')!;
      formEl.scrollTo({ top: formEl.scrollHeight, behavior: 'smooth' });
    };

    const inputValue = filter !== undefined
      ? filter
      : (value && value.name) || '';

    return (
      <div className={buildClassName('input-group', value && 'touched')}>
        <input
          ref={inputRef}
          className={buildClassName('form-control', isOpen && 'focus')}
          type="text"
          id={id}
          value={inputValue}
          autoComplete="off"
          onClick={handleTrigger}
          onFocus={handleTrigger}
          onInput={handleInput}
          onKeyDown={handleInputKeyDown}
        />
        <label>Country</label>
        {isLoading ? (
          <Spinner color="black" />
        ) : (
          <i onClick={handleTrigger} className={buildClassName('css-icon-down', isOpen && 'open')} />
        )}
      </div>
    );
  };

  return (
    <DropdownMenu
      className="CountryCodeInput"
      trigger={CodeInput}
    >
      {filteredList.map((country: Country) => (
        <MenuItem
          key={country.id}
          className={value && country.id === value.id ? 'selected' : ''}
          onClick={handleChange}
        >
          <span data-country-id={country.id} />
          <span className="country-flag">{renderText(country.flag, ['hq_emoji'])}</span>
          <span className="country-name">{country.name}</span>
          <span className="country-code">{country.code}</span>
        </MenuItem>
      ))}
      {!filteredList.length && (
        <MenuItem
          key="no-results"
          className="no-results"
          disabled
        >
          <span>No countries matched your filter.</span>
        </MenuItem>
      )}
    </DropdownMenu>
  );
};

function getFilteredList(filter = ''): Country[] {
  return filter.length
    ? countryList.filter((country) => searchWords(country.name, filter))
    : countryList;
}

export default memo(CountryCodeInput);
