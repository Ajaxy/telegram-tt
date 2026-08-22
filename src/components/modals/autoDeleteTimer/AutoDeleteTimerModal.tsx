import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';

import { selectChatHistoryTtl } from '../../../global/selectors';
import {
  buildAutoDeletePeriodOptions,
  CUSTOM_AUTO_DELETE_PERIODS,
} from '../../common/helpers/autoDeletePeriods';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Control, { ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Modal, {
  ModalCloseButton,
  ModalFooterActions,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';
import Radio from '@gili/primitives/Radio';

import styles from './AutoDeleteTimerModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['autoDeleteTimerModal']>;
  isOpen: boolean;
};

type StateProps = {
  currentPeriod?: number;
};

const AutoDeleteTimerModal = ({
  modal,
  isOpen,
  currentPeriod,
}: OwnProps & StateProps) => {
  const { closeAutoDeleteTimerModal, setChatHistoryTtl } = getActions();

  const listRef = useRef<HTMLDivElement>();

  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod ?? 0);

  const lang = useLang();

  const options = useMemo(() => buildAutoDeletePeriodOptions(
    lang,
    CUSTOM_AUTO_DELETE_PERIODS,
    currentPeriod,
    lang('AutoDeleteNever'),
  ), [lang, currentPeriod]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('input:checked')?.scrollIntoView({ block: 'center' });
  }, []);

  const handleClose = useLastCallback(() => {
    closeAutoDeleteTimerModal();
  });

  const handlePeriodChange = useLastCallback((value: string) => {
    setSelectedPeriod(Number(value));
  });

  const handleSave = useLastCallback(() => {
    if (selectedPeriod !== (currentPeriod ?? 0)) {
      setChatHistoryTtl({ chatId: modal.chatId, period: selectedPeriod });
    }

    closeAutoDeleteTimerModal();
  });

  const header = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
      <ModalTitle>{lang('AutoDeleteMessages')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  const footer = useMemo(() => (
    <ModalFooterActions className={styles.footer}>
      <Button isText size="smaller" color="primary" fluid onClick={handleClose}>
        {lang('Cancel')}
      </Button>
      <Button isText size="smaller" color="primary" fluid onClick={handleSave}>
        {lang('Save')}
      </Button>
    </ModalFooterActions>
  ), [lang]);

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      stickyFooter={footer}
      width="slim"
      onClose={handleClose}
    >
      <p className={styles.description}>{lang('AutoDeletePopupDescription')}</p>
      <div ref={listRef}>
        {options.map(({ label, value }) => (
          <Interactive key={value} asLabel clickable>
            <Control>
              <Radio
                name="auto_delete_period"
                value={value}
                checked={Number(value) === selectedPeriod}
                onChange={handlePeriodChange}
              />
              <ControlLabel>{label}</ControlLabel>
            </Control>
          </Interactive>
        ))}
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    return {
      currentPeriod: selectChatHistoryTtl(global, modal.chatId),
    };
  },
)(AutoDeleteTimerModal));
