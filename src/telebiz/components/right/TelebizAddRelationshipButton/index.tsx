import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { Integration, ProviderRelationship } from '../../../services/types';

import { selectCurrentMessageList } from '../../../../global/selectors';
import {
  selectTelebizIntegrationsList,
  selectTelebizIsAddingRelationship,
  selectTelebizProperties,
  selectTelebizSelectedIntegrationId,
  selectTelebizSelectedRelationship,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useOldLang from '../../../../hooks/useOldLang';

import Icon from '../../../../components/common/icons/Icon';
import Button from '../../../../components/ui/Button';
import AddRelationshipMenu from '../TelebizAddRelationshipMenu';

import './AddRelationshipButton.scss';

type OwnProps = {
  isShown: boolean;
};

type StateProps = {
  selectedRelationship?: ProviderRelationship;
  isAddingRelationship: boolean;
  selectedIntegrationId?: number;
  integrations: Integration[];
  properties: any[];
};

const AddRelationshipButton: FC<OwnProps & StateProps> = ({
  isShown,
  selectedRelationship,
  isAddingRelationship,
  selectedIntegrationId,
  integrations,
  properties,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isShown) {
      setIsMenuOpen(false);
    }
  }, [isShown]);

  const lang = useOldLang();

  const fabClassName = buildClassName(
    'AddRelationshipButton',
    isShown && 'revealed',
    isMenuOpen && 'menu-is-open',
  );

  const toggleIsMenuOpen = useCallback(() => {
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen]);

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
  }, [setIsMenuOpen]);

  return (
    <div className={fabClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <Button
        round
        color="primary"
        className={isMenuOpen ? 'active' : ''}
        onClick={toggleIsMenuOpen}
        ariaLabel={lang(isMenuOpen ? 'Close' : 'NewMessageTitle')}
        tabIndex={-1}
      >
        <Icon name="add" />
        <Icon name="close" />
      </Button>
      <AddRelationshipMenu
        isOpen={isMenuOpen}
        onClose={handleClose}
        selectedRelationship={selectedRelationship}
        isAddingRelationship={isAddingRelationship}
        selectedIntegrationId={selectedIntegrationId}
        integrations={integrations}
        properties={properties}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedIntegrationId = selectTelebizSelectedIntegrationId(global);

    return {
      selectedRelationship: chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined,
      isAddingRelationship: selectTelebizIsAddingRelationship(global),
      selectedIntegrationId,
      integrations: selectTelebizIntegrationsList(global),
      properties: selectedIntegrationId ? selectTelebizProperties(global, selectedIntegrationId) : [],
    };
  },
)(AddRelationshipButton));
