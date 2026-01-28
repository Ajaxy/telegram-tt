import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ProviderRelationship } from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { selectTelebizChatRelationships } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import ListItem from '../../../../components/ui/ListItem';
import TelebizRelationshipsListItem from './TelebizRelationshipsListItem';

import styles from './TelebizRelationshipsList.module.scss';

type OwnProps = {
  chatId: string;
};

type StateProps = {
  relationships: ProviderRelationship[];
};

const TelebizRelationshipsList: FC<OwnProps & StateProps> = ({ chatId, relationships }) => {
  const lang = useTelebizLang();
  const { openTelebizPanelScreen, setTelebizIsAddingRelationship } = getActions();

  return (
    <div className={buildClassName(styles.container, 'no-scrollbar')}>
      <div className={styles.list}>
        {relationships.map((relationship) => (
          <TelebizRelationshipsListItem key={relationship.id} relationship={relationship} chatId={chatId} />
        ))}
        <ListItem
          icon="add"
          withPrimaryColor
          onClick={() => {
            setTelebizIsAddingRelationship({ isAdding: true });
            openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
          }}
        >
          {lang('TelebizRelationshipsList.AddRelationship')}
        </ListItem>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => ({
    relationships: selectTelebizChatRelationships(global, chatId),
  }),
)(TelebizRelationshipsList));
