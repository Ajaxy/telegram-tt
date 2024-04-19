import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import { GIVEAWAY_MAX_ADDITIONAL_CHANNELS } from '../../../config';
import {
  filterUsersByName, isUserBot,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { unique } from '../../../util/iteratees';
import sortChatIds from '../../common/helpers/sortChatIds';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/Icon';
import Picker from '../../common/Picker';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './PremiumGiftingModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

interface StateProps {
  currentUserId?: string;
  userSelectionLimit?: number;
  userIds?: string[];
}

const PremiumGiftingModal: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  userSelectionLimit = GIVEAWAY_MAX_ADDITIONAL_CHANNELS,
  userIds,
}) => {
  const { closePremiumGiftingModal, openGiftPremiumModal, showNotification } = getActions();

  const lang = useLang();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const displayedUserIds = useMemo(() => {
    const usersById = getGlobal().users.byId;
    const filteredContactIds = userIds ? filterUsersByName(userIds, usersById, searchQuery) : [];

    return sortChatIds(unique(filteredContactIds).filter((userId) => {
      const user = usersById[userId];
      if (!user) {
        return true;
      }

      return !isUserBot(user) && userId !== currentUserId;
    }));
  }, [currentUserId, searchQuery, userIds]);

  const handleSendIdList = useLastCallback(() => {
    if (selectedUserIds?.length) {
      openGiftPremiumModal({ forUserIds: selectedUserIds });

      closePremiumGiftingModal();
    }
  });

  const handleSelectedUserIdsChange = useLastCallback((newSelectedIds: string[]) => {
    if (newSelectedIds.length > userSelectionLimit) {
      showNotification({
        message: lang('BoostingSelectUpToWarningUsers', userSelectionLimit),
      });
      return;
    }
    setSelectedUserIds(newSelectedIds);
  });

  function renderSearchField() {
    return (
      <div className={styles.filter} dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          size="smaller"
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => closePremiumGiftingModal()}
          ariaLabel={lang('Close')}
        >
          <Icon name="close" />
        </Button>
        <h3 className={styles.title}>{lang('GiftTelegramPremiumTitle')}
        </h3>
      </div>
    );
  }

  return (
    <Modal
      className={styles.root}
      isOpen={isOpen}
      onClose={closePremiumGiftingModal}
      onEnter={handleSendIdList}
    >
      <div className={styles.main}>
        {renderSearchField()}
        <div className={buildClassName(styles.main, 'custom-scroll')}>
          <Picker
            className={styles.picker}
            itemIds={displayedUserIds}
            selectedIds={selectedUserIds}
            filterValue={searchQuery}
            filterPlaceholder={lang('Search')}
            searchInputId="users-picker-search"
            onSelectedIdsChange={handleSelectedUserIdsChange}
            onFilterChange={setSearchQuery}
            isSearchable
          />
        </div>
        <div className={styles.buttons}>
          <Button withPremiumGradient size="smaller" onClick={handleSendIdList} disabled={!selectedUserIds?.length}>
            {lang('Continue')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { currentUserId } = global;

  return {
    currentUserId,
    userIds: global.contactList?.userIds,
    userSelectionLimit: global.appConfig?.giveawayAddPeersMax,
  };
})(PremiumGiftingModal));
