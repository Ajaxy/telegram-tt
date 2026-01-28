import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Skill, SkillType } from '../../../agent/types';

import { selectTabState } from '../../../../global/selectors';
import { selectTelebizSkillsIsSaving } from '../../../global/selectors';
import CustomSkillsModal from '.';

import useLastCallback from '../../../../hooks/useLastCallback';

interface SkillData {
  name: string;
  context: string;
  content: string;
  skillType: SkillType;
  isActive: boolean;
}

type StateProps = {
  isOpen: boolean;
  editingItem?: Skill;
  isSaving: boolean;
};

const CustomSkillsModalContainer = ({
  isOpen,
  editingItem,
  isSaving,
}: StateProps) => {
  const {
    closeSkillsModal,
    addSkill,
    updateSkill,
  } = getActions();

  const handleClose = useLastCallback(() => {
    closeSkillsModal();
  });

  const handleSave = useLastCallback((data: SkillData) => {
    addSkill(data);
    closeSkillsModal();
  });

  const handleUpdate = useLastCallback((id: string, data: SkillData) => {
    updateSkill({
      id,
      updates: data,
    });
    closeSkillsModal();
  });

  if (!isOpen) {
    return undefined;
  }

  return (
    <CustomSkillsModal
      isOpen={isOpen}
      editingItem={editingItem}
      isSaving={isSaving}
      onClose={handleClose}
      onSave={handleSave}
      onUpdate={handleUpdate}
    />
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const isSaving = selectTelebizSkillsIsSaving(global);

    return {
      isOpen: Boolean(tabState.skillsModal?.isOpen),
      editingItem: tabState.skillsModal?.editingItem,
      isSaving,
    };
  },
)(CustomSkillsModalContainer));
