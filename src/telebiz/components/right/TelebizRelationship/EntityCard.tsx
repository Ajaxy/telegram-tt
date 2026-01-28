import { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import {
  type ProviderCompany,
  type ProviderContact,
  type ProviderDeal,
  ProviderEntityType,
  type ProviderMeeting,
  type ProviderNote,
  type ProviderPage,
  type ProviderTask,
} from '../../../services/types';

import { selectTelebizEntityLoadingState } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import Spinner from '../../../../components/ui/Spinner';
import CompanyCard from './Companies/CompanyCard';
import ContactCard from './Contacts/ContactCard';
import DealCard from './Deals/DealCard';
import MeetingCard from './Meetings/MeetingCard';
import NoteCard from './Notes/NoteCard';
import PageCard from './Pages/PageCard';
import TaskCard from './Tasks/TaskCard';

import styles from './RelationshipEntityCard.module.scss';

export type ProviderEntityWithType =
  | ({
    entityType: ProviderEntityType.Contact;
    onEntitySelected: (entity: ProviderContact) => void;
  } & ProviderContact)
  | ({ entityType: ProviderEntityType.Deal } & ProviderDeal)
  | ({ entityType: ProviderEntityType.Meeting } & ProviderMeeting)
  | ({ entityType: ProviderEntityType.Note } & ProviderNote)
  | ({ entityType: ProviderEntityType.Task } & ProviderTask)
  | ({
    entityType: ProviderEntityType.Page;
    onEntitySelected: (entity: ProviderPage) => void;
  } & ProviderPage)
  | ({
    entityType: ProviderEntityType.Company;
    onEntitySelected: (entity: ProviderCompany) => void;
  } & ProviderCompany);

interface OwnProps {
  item: ProviderEntityWithType;
}

type StateProps = {
  isLoading: boolean;
};

const renderEntityCard = (item: ProviderEntityWithType) => {
  switch (item.entityType) {
    case ProviderEntityType.Contact:
      return (
        <ContactCard
          contact={item as ProviderContact}
          onContactSelected={item.onEntitySelected}
        />
      );
    case ProviderEntityType.Deal:
      return <DealCard deal={item as ProviderDeal} />;
    case ProviderEntityType.Meeting:
      return <MeetingCard meeting={item as ProviderMeeting} />;
    case ProviderEntityType.Note:
      return <NoteCard note={item as ProviderNote} />;
    case ProviderEntityType.Task:
      return <TaskCard task={item as ProviderTask} />;
    case ProviderEntityType.Page:
      return (
        <PageCard
          page={item as ProviderPage}
          onPageSelected={(item as any).onEntitySelected}
        />
      );
    case ProviderEntityType.Company:
      return (
        <CompanyCard
          company={item as ProviderCompany}
          onCompanySelected={(item as any).onEntitySelected}
        />
      );
    default:
      return undefined;
  }
};

const EntityCard = ({ item, isLoading }: OwnProps & StateProps) => {
  return (
    <div
      className={buildClassName(
        styles.itemWrapper,
        isLoading && styles.loading,
      )}
    >
      {renderEntityCard(item)}
      {isLoading && (
        <div className={styles.loaderWrapper}>
          <Spinner className={styles.loader} color="gray" />
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { item }): StateProps => {
    const loadingState = selectTelebizEntityLoadingState(global);
    const isLoading = loadingState?.loadingType === item.entityType && loadingState?.entityId === item.id;
    return { isLoading };
  },
)(EntityCard));
