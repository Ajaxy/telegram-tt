import type { FC } from '../../lib/teact/teact';
import {
  memo, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiCountry } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ItemPicker from './pickers/ItemPicker';

import styles from './CountryPickerModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string[]) => void;
  countryList: ApiCountry[];
  selectionLimit?: number | undefined;
};

const CountryPickerModal: FC<OwnProps> = ({
  isOpen,
  onClose,
  onSubmit,
  countryList,
  selectionLimit,
}) => {
  const { showNotification } = getActions();

  const lang = useOldLang();

  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const prevSelectedCountryIds = usePreviousDeprecated(selectedCountryIds);
  const noPickerScrollRestore = prevSelectedCountryIds === selectedCountryIds;

  const displayedIds = useMemo(() => {
    if (!countryList) {
      return [];
    }

    return countryList.filter((country) => !country.isHidden && country.iso2 !== 'FT')
      .map(({
        iso2, defaultName,
      }) => ({
        value: iso2,
        label: defaultName,
      }));
  }, [countryList]);

  const handleSelectedIdsChange = useLastCallback((newSelectedIds: string[]) => {
    if (selectionLimit && newSelectedIds.length > selectionLimit) {
      showNotification({
        message: lang('BoostingSelectUpToWarningCountries', selectionLimit),
      });
      return;
    }
    setSelectedCountryIds(newSelectedIds);
  });

  const handleSubmit = useLastCallback(() => {
    onSubmit(selectedCountryIds);
    onClose();
  });

  return (
    <Modal
      className={styles.root}
      isOpen={isOpen}
      onClose={onClose}
      onEnter={handleSubmit}
      hasAbsoluteCloseButton
    >
      <div className={styles.container}>
        <div className={styles.pickerSelector}>

          <h4 className={styles.pickerTitle}>
            {lang('BoostingSelectCountry')}
          </h4>
        </div>
      </div>

      <div className={buildClassName(styles.main, 'custom-scroll')}>
        <ItemPicker
          className={styles.picker}
          items={displayedIds}
          selectedValues={selectedCountryIds}
          onSelectedValuesChange={handleSelectedIdsChange}
          noScrollRestore={noPickerScrollRestore}
          allowMultiple
          itemInputType="checkbox"
        />
      </div>

      <div className={styles.footer}>
        <Button
          onClick={handleSubmit}
        >
          {lang('SelectCountries.OK')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(CountryPickerModal);
