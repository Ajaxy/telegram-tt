import type { ChangeEvent } from 'react';
import { memo, useEffect, useMemo, useState } from '../../../../lib/teact/teact';

import type { Skill, SkillType } from '../../../agent/types';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Button from '../../../../components/ui/Button';
import InputText from '../../../../components/ui/InputText';
import Modal from '../../../../components/ui/Modal';
import Select from '../../../../components/ui/Select';
import Switcher from '../../../../components/ui/Switcher';
import TextArea from '../../../../components/ui/TextArea';

import styles from './CustomSkillsModal.module.scss';

interface SkillData {
  name: string;
  context: string;
  content: string;
  skillType: SkillType;
  isActive: boolean;
}

interface OwnProps {
  isOpen: boolean;
  editingItem?: Skill;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (data: SkillData) => void;
  onUpdate: (id: string, data: SkillData) => void;
}

const CustomSkillsModal = ({
  isOpen,
  editingItem,
  isSaving,
  onClose,
  onSave,
  onUpdate,
}: OwnProps) => {
  const lang = useTelebizLang();

  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [content, setContent] = useState('');
  const [skillType, setSkillType] = useState<SkillType>('tool');
  const [isActive, setIsActive] = useState(true);

  const isEditing = Boolean(editingItem);
  const isValid = context.trim().length > 0 && content.trim().length > 0;

  // Generate skill type options
  const skillTypeOptions = useMemo(() => [
    {
      label: lang('Agent.Skills.Type.Knowledge'),
      subLabel: lang('Agent.Skills.Type.KnowledgeHint'),
      value: 'knowledge',
    },
    {
      label: lang('Agent.Skills.Type.Tool'),
      subLabel: lang('Agent.Skills.Type.ToolHint'),
      value: 'tool',
    },
    {
      label: lang('Agent.Skills.Type.OnDemand'),
      subLabel: lang('Agent.Skills.Type.OnDemandHint'),
      value: 'onDemand',
    },
  ], [lang]);

  useEffect(() => {
    if (isOpen && editingItem) {
      setName(editingItem.name || '');
      setContext(editingItem.context);
      setContent(editingItem.content);
      setSkillType(editingItem.skillType || 'tool');
      setIsActive(editingItem.isActive);
    } else if (isOpen) {
      setName('');
      setContext('');
      setContent('');
      setSkillType('tool');
      setIsActive(true);
    }
  }, [isOpen, editingItem]);

  const handleNameChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    // Only allow valid tag characters
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setName(value);
  });

  const handleContextChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setContext(e.target.value);
  });

  const handleContentChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  });

  const handleSkillTypeChange = useLastCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setSkillType(e.target.value as SkillType);
  });

  const handleToggleActive = useLastCallback(() => {
    setIsActive(!isActive);
  });

  const handleSubmit = useLastCallback(() => {
    if (!isValid) return;

    const data: SkillData = {
      name: name.trim(),
      context: context.trim(),
      content: content.trim(),
      skillType,
      isActive,
    };

    if (editingItem) {
      onUpdate(editingItem.id, data);
    } else {
      onSave(data);
    }
  });

  return (
    <Modal
      className={styles.modal}
      isOpen={isOpen}
      onClose={onClose}
      contentClassName={styles.modalContent}
      title={isEditing ? lang('Agent.Skills.EditSkill') : lang('Agent.Skills.AddSkill')}
      hasCloseButton
    >
      <div className={styles.form}>
        {/* Skill Type */}
        <div className={styles.section}>
          <label className={styles.label}>{lang('Agent.Skills.Type')}</label>
          <Select
            id="skill-type"
            onChange={handleSkillTypeChange}
          >
            {skillTypeOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className={styles.selectOption}
                selected={skillType === option.value}
              >
                <div className={styles.optionLabel}>{option.label}</div>
              </option>
            ))}
          </Select>
          {/* Skill Type Hint */}
          <p className={styles.hint}>
            {skillTypeOptions.find((opt) => opt.value === skillType)?.subLabel}
          </p>
        </div>

        {/* Skill Name/Tag */}
        <div className={styles.section}>
          <InputText
            label={lang('Agent.Skills.Name')}
            value={name}
            onChange={handleNameChange}
            maxLength={30}
            disabled={isSaving}
          />
          <p className={styles.hint}>
            {skillType === 'onDemand'
              ? lang('Agent.Skills.Modal.NameHintOnDemand')
              : lang('Agent.Skills.Modal.NameHint')}
          </p>
        </div>

        {/* Context */}
        <div className={styles.section}>
          <TextArea
            className={styles.contextInput}
            label={lang('Agent.Skills.Context')}
            value={context}
            onChange={handleContextChange}
            maxLength={500}
            disabled={isSaving}
            noReplaceNewlines
          />
          <p className={styles.hint}>
            {lang('Agent.Skills.Modal.ContextHint')}
          </p>
        </div>

        {/* Content */}
        <div className={styles.section}>
          <TextArea
            className={styles.contentInput}
            label={lang('Agent.Skills.Content')}
            value={content}
            onChange={handleContentChange}
            maxLength={10000}
            disabled={isSaving}
            noReplaceNewlines
          />
          <p className={styles.hint}>
            {lang('Agent.Skills.Modal.ContentHint')}
          </p>
        </div>

        {/* Active Toggle */}
        <div className={styles.switcherRow}>
          <span>{lang('Agent.Skills.Modal.IsActive')}</span>
          <Switcher
            id="skill-is-active"
            label={lang('Agent.Skills.Modal.IsActive')}
            checked={isActive}
            onChange={handleToggleActive}
          />
        </div>

        <div className={styles.buttons}>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSaving}
            isLoading={isSaving}
          >
            {lang('Agent.Skills.Modal.Save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(CustomSkillsModal);
