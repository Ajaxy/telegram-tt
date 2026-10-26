import { memo } from '../../../../lib/teact/teact';

import type { Signal } from '../../../../util/signals';

import useDerivedState from '../../../../hooks/useDerivedState';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import SearchInput from '../../../ui/SearchInput';

type OwnProps = {
  getQuery: Signal<string>;
  onChange: (query: string) => void;
};

const RESULTS_ITEM_SELECTOR = '.SettingsSearch .ListItem-button';

const SettingsSearchInput = ({ getQuery, onChange }: OwnProps) => {
  const lang = useLang();
  const query = useDerivedState(getQuery);

  const handleReset = useLastCallback(() => {
    onChange('');
  });

  return (
    <SearchInput
      variant="island"
      value={query}
      placeholder={lang('Search')}
      autoComplete="off"
      autoFocusSearch
      resultsItemSelector={RESULTS_ITEM_SELECTOR}
      onChange={onChange}
      onReset={handleReset}
    />
  );
};

export default memo(SettingsSearchInput);
