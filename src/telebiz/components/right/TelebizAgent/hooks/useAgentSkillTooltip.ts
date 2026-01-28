import type { ElementRef } from '../../../../../lib/teact/teact';
import { useEffect, useState } from '../../../../../lib/teact/teact';
import { getGlobal } from '../../../../../global';

import type { Skill } from '../../../../agent/types';

import { selectOnDemandSkills } from '../../../../global/selectors';

import useFlag from '../../../../../hooks/useFlag';
import useLastCallback from '../../../../../hooks/useLastCallback';

// Match /skill-name pattern at cursor position
const RE_SKILL_SEARCH = /(^|\s)\/([a-zA-Z][a-zA-Z0-9_-]*)$/;

export default function useAgentSkillTooltip(
  isEnabled: boolean,
  inputValue: string,
  inputRef: ElementRef<HTMLTextAreaElement>,
  onInsertSkill: (beforeSkill: string, skillTag: string, afterSkill: string) => void,
) {
  const [filteredSkills, setFilteredSkills] = useState<Skill[] | undefined>();
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  // Extract the /skill query from input value using cursor position
  const getSkillQuery = useLastCallback(() => {
    if (!isEnabled || !inputValue.includes('/')) return undefined;

    const textarea = inputRef.current;
    if (!textarea) return undefined;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPosition);

    const match = textBeforeCursor.match(RE_SKILL_SEARCH);
    if (!match) return undefined;

    return {
      query: match[2] || '', // The text after /
      startIndex: textBeforeCursor.lastIndexOf('/'),
    };
  });

  useEffect(() => {
    const skillData = getSkillQuery();

    if (!skillData) {
      setFilteredSkills(undefined);
      return;
    }

    const global = getGlobal();
    const onDemandSkills = selectOnDemandSkills(global);

    if (!onDemandSkills.length) {
      setFilteredSkills(undefined);
      return;
    }

    const query = skillData.query.toLowerCase();

    // Filter skills by name matching the query
    const filtered = onDemandSkills
      .filter((skill) => {
        const skillName = skill.name.toLowerCase();
        // Match if skill name starts with query or contains query
        return skillName.startsWith(query) || skillName.includes(query);
      })
      .slice(0, 8); // Limit to 8 suggestions

    setFilteredSkills(filtered.length > 0 ? filtered : undefined);
  }, [inputValue, getSkillQuery]);

  const insertSkill = useLastCallback((skill: Skill) => {
    const skillData = getSkillQuery();
    if (!skillData) return;

    const skillTag = `/${skill.name} `;
    const { startIndex } = skillData;
    const beforeSkill = inputValue.substring(0, startIndex);

    // Find the end of the current skill query
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const afterSkill = inputValue.substring(cursorPosition);

    onInsertSkill(beforeSkill, skillTag, afterSkill);
    setFilteredSkills(undefined);
  });

  // Reset manually closed state when input changes
  useEffect(() => {
    unmarkManuallyClosed();
  }, [inputValue, unmarkManuallyClosed]);

  return {
    isSkillTooltipOpen: Boolean(filteredSkills?.length && !isManuallyClosed),
    closeSkillTooltip: markManuallyClosed,
    insertSkill,
    filteredSkills,
  };
}
