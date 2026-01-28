import { memo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Skill } from '../../../agent/types';

import {
  selectTelebizSkillsIsLoading,
  selectTelebizSkillsList,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import ListItem from '../../../../components/ui/ListItem';
import Spinner from '../../../../components/ui/Spinner';
import CustomSkillsModalContainer from '../../modals/CustomSkillsModal/CustomSkillsModalContainer';

type StateProps = {
  skills: Skill[];
  isLoading: boolean;
};

const CustomSkills = ({
  skills,
  isLoading,
}: StateProps) => {
  const lang = useTelebizLang();
  const {
    openSkillsModal,
    updateSkill,
    deleteSkill,
  } = getActions();

  const [deleteId, setDeleteId] = useState<string | undefined>(undefined);

  const isEmpty = skills.length === 0;

  const handleAdd = useLastCallback(() => {
    openSkillsModal({});
  });

  const handleEdit = useLastCallback((item: Skill) => {
    openSkillsModal({ editingItem: item });
  });

  const handleDeleteClick = useLastCallback((id: string) => {
    setDeleteId(id);
  });

  const handleDeleteConfirm = useLastCallback(() => {
    if (!deleteId) return;
    deleteSkill({ id: deleteId });
    setDeleteId(undefined);
  });

  const handleDeleteCancel = useLastCallback(() => {
    setDeleteId(undefined);
  });

  const handleToggleActive = useLastCallback((item: Skill) => {
    updateSkill({
      id: item.id,
      updates: { isActive: !item.isActive },
    });
  });

  if (isLoading) {
    return (
      <div className="settings-content custom-scroll">
        <div className="settings-item pt-3">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-content custom-scroll">
      {/* Description */}
      <div className="settings-item">
        <p className="settings-item-description">
          {lang('Agent.Skills.Description')}
        </p>

        <div className="pt-4 pb-4">
          <ListItem
            icon="add"
            narrow
            withPrimaryColor
            onClick={handleAdd}
          >
            {lang('Agent.Skills.AddSkill')}
          </ListItem>
        </div>

        {/* Empty State */}
        {isEmpty && (
          <p className="settings-item-description">
            {lang('Agent.Skills.EmptyDescription')}
          </p>
        )}
        {/* Skills List */}
        {skills.length > 0 && skills.map((item) => {
          const skillTypeLabel = item.skillType === 'knowledge'
            ? lang('Agent.Skills.Type.Knowledge')
            : item.skillType === 'onDemand'
              ? lang('Agent.Skills.Type.OnDemand')
              : lang('Agent.Skills.Type.Tool');
          const tagDisplay = item.skillType === 'onDemand' ? `/${item.name}` : item.name;

          return (
            <ListItem
              key={item.id}
              multiline
              narrow
              secondaryIcon={item.isActive ? 'check' : 'close'}
              className={buildClassName(!item.isActive && 'opacity-50')}
              onClick={() => handleEdit(item)}
              contextActions={[
                {
                  title: item.isActive ? lang('Agent.Skills.Deactivate') : lang('Agent.Skills.Activate'),
                  icon: item.isActive ? 'close' : 'check',
                  handler: () => handleToggleActive(item),
                },
                {
                  title: lang('Agent.Skills.DeleteSkill'),
                  icon: 'delete',
                  destructive: true,
                  handler: () => handleDeleteClick(item.id),
                },
              ]}
            >
              <span className="title">
                {item.name && <span className="tag">{tagDisplay}</span>}
                {' '}
                <span className="badge">{skillTypeLabel}</span>
              </span>
              <span className="subtitle">{item.context}</span>
            </ListItem>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={handleDeleteCancel}
        confirmHandler={handleDeleteConfirm}
        confirmIsDestructive
        title={lang('Agent.Skills.DeleteSkill')}
        text={lang('Agent.Skills.Modal.DeleteConfirm')}
        confirmLabel={lang('Agent.Skills.Modal.Delete')}
      />

      <CustomSkillsModalContainer />
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => ({
    skills: selectTelebizSkillsList(global),
    isLoading: selectTelebizSkillsIsLoading(global),
  }),
)(CustomSkills));
