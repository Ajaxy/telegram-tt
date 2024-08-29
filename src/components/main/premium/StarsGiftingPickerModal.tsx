import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import {
  filterUsersByName, isDeletedUser, isUserBot,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { unique } from '../../../util/iteratees';
import sortChatIds from '../../common/helpers/sortChatIds';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import PeerPicker from '../../common/pickers/PeerPicker';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './StarsGiftingPickerModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

interface StateProps {
  currentUserId?: string;
  userIds?: string[];
  activeListIds?: string[];
  archivedListIds?: string[];
}

const StarsGiftingPickerModal: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  activeListIds,
  archivedListIds,
  userIds,
}) => {
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);
  const { closeStarsGiftingModal, openStarsGiftModal } = getActions();

  const oldLang = useOldLang();

  const [searchQuery, setSearchQuery] = useState<string>('');

  const displayedUserIds = useMemo(() => {
    const usersById = getGlobal().users.byId;
    const combinedIds = [
      ...(userIds || []),
      ...(activeListIds || []),
      ...(archivedListIds || []),
    ];

    const filteredContactIds = filterUsersByName(combinedIds, usersById, searchQuery);

    return sortChatIds(unique(filteredContactIds).filter((id) => {
      const user = usersById[id];

      if (!user) {
        return false;
      }

      return !user.isSupport
        && !isUserBot(user) && !isDeletedUser(user)
        && id !== currentUserId && id !== SERVICE_NOTIFICATIONS_USER_ID;
    }));
  }, [currentUserId, searchQuery, userIds, activeListIds, archivedListIds]);

  const handleSelectedUserIdsChange = useLastCallback((newSelectedId?: string) => {
    if (newSelectedId?.length) {
      openStarsGiftModal({ forUserId: newSelectedId });
    }
  });

  function renderHeaderText() {
    return (
      <div className={styles.filter} dir={oldLang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          size="smaller"
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => closeStarsGiftingModal()}
          ariaLabel={oldLang('Close')}
        >
          <Icon name="close" />
        </Button>
        <h3 className={buildClassName(styles.title, 'ml-2')}>{oldLang('GiftStarsTitle')}
        </h3>
      </div>
    );
  }

  return (
    <Modal
      className={styles.root}
      isOpen={isOpen}
      onClose={closeStarsGiftingModal}
      onEnter={handleSelectedUserIdsChange}
      dialogRef={dialogRef}
    >
      <div className={buildClassName(styles.main, 'custom-scroll')}>
        {renderHeaderText()}
        <PeerPicker
          className={styles.picker}
          itemIds={displayedUserIds}
          filterValue={searchQuery}
          filterPlaceholder={oldLang('Search')}
          onFilterChange={setSearchQuery}
          isSearchable
          withDefaultPadding
          withStatus
          onSelectedIdChange={handleSelectedUserIdsChange}
        />
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    chats: {
      listIds,
    },
    currentUserId,
  } = global;

  return {
    userIds: global.contactList?.userIds,
    activeListIds: listIds.active,
    archivedListIds: listIds.archived,
    currentUserId,
  };
})(StarsGiftingPickerModal));
