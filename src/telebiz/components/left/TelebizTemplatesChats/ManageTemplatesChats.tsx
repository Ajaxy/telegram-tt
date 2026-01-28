import { memo, useEffect, useMemo, useState } from '@teact';
import { getActions, getPromiseActions, withGlobal } from '../../../../global';

import { TelebizSettingsScreens } from '../types';

import { filterPeersByQuery } from '../../../../global/helpers/peers';
import { selectTelebizTemplatesChatsList } from '../../../global/selectors/templatesChats';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import PeerPicker from '../../../../components/common/pickers/PeerPicker';
import FloatingActionButton from '../../../../components/ui/FloatingActionButton';

type StateProps = {
  chatIds?: string[];
  templatesChats: string[];
};

const TelebizManageTemplatesChats = ({ chatIds, templatesChats }: StateProps) => {
  const lang = useTelebizLang();
  const { openTelebizSettingsScreen } = getActions();

  const [search, setSearch] = useState('');
  const [isSubmitShown, setIsSubmitShown] = useState(false);
  const [newSelectedChatIds, setNewSelectedChatIds] = useState<string[]>(templatesChats);

  useEffect(() => {
    setNewSelectedChatIds(templatesChats);
    setIsSubmitShown(false);
  }, [templatesChats]);

  const filteredIds = filterPeersByQuery({
    ids: chatIds || [],
    query: search,
  });

  const hasChanges = useMemo(() => {
    if (newSelectedChatIds.length !== templatesChats.length) {
      return true;
    }
    return !newSelectedChatIds.every((id) => templatesChats.includes(id));
  }, [newSelectedChatIds, templatesChats]);

  useEffect(() => {
    setIsSubmitShown(hasChanges);
  }, [hasChanges]);

  const handleSubmit = useLastCallback(async () => {
    try {
      await getPromiseActions().updateTelebizTemplatesChatsList({ chatIds: newSelectedChatIds });
      setIsSubmitShown(false);
      openTelebizSettingsScreen({ screen: TelebizSettingsScreens.TemplatesChats });
    } catch (err) {
      console.error(err);
    }
  });

  return (
    <div className="Picker settings-folders-chat-list">
      <PeerPicker
        itemIds={filteredIds}
        selectedIds={newSelectedChatIds}
        filterValue={search}
        filterPlaceholder="Search chats..."
        isSearchable
        allowMultiple
        withDefaultPadding
        onSelectedIdsChange={setNewSelectedChatIds}
        onFilterChange={setSearch}
        itemInputType="checkbox"
      />
      <FloatingActionButton
        isShown={isSubmitShown}
        onClick={handleSubmit}
        ariaLabel={lang('Save')}
        iconName="check"
      />
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const { listIds } = global.chats;

    return {
      chatIds: listIds.active,
      templatesChats: selectTelebizTemplatesChatsList(global),
    };
  },
)(TelebizManageTemplatesChats));
