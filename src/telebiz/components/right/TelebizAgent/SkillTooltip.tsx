import { memo, useEffect, useRef } from '../../../../lib/teact/teact';

import type { Skill } from '../../../agent/types';

import buildClassName from '../../../../util/buildClassName';
import setTooltipItemVisible from '../../../../util/setTooltipItemVisible';

import { useKeyboardNavigation } from '../../../../components/middle/composer/hooks/useKeyboardNavigation';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../../hooks/usePreviousDeprecated';
import useShowTransitionDeprecated from '../../../../hooks/useShowTransitionDeprecated';

import ListItem from '../../../../components/ui/ListItem';

import styles from './SkillTooltip.module.scss';

type OwnProps = {
  isOpen: boolean;
  filteredSkills?: Skill[];
  onClose: () => void;
  onSelectSkill: (skill: Skill) => void;
};

const SkillTooltip = ({
  isOpen,
  filteredSkills,
  onClose,
  onSelectSkill,
}: OwnProps) => {
  const containerRef = useRef<HTMLDivElement>();
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen, undefined, undefined, false);

  const handleClick = useLastCallback((e: React.MouseEvent, skillId: string) => {
    e.preventDefault();
    const skill = filteredSkills?.find((s) => s.id === skillId);
    if (skill) {
      onSelectSkill(skill);
    }
  });

  const handleSelectSkill = useLastCallback((skill: Skill) => {
    onSelectSkill(skill);
  });

  const selectedSkillIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: filteredSkills,
    onSelect: handleSelectSkill,
    shouldSelectOnTab: true,
    shouldSaveSelectionOnUpdateItems: true,
    onClose,
  });

  useEffect(() => {
    setTooltipItemVisible('.skill-item-clickable', selectedSkillIndex, containerRef);
  }, [selectedSkillIndex]);

  useEffect(() => {
    if (filteredSkills && !filteredSkills.length) {
      onClose();
    }
  }, [filteredSkills, onClose]);

  const prevSkills = usePreviousDeprecated(
    filteredSkills?.length ? filteredSkills : undefined,
    shouldRender,
  );
  const renderedSkills = filteredSkills && !filteredSkills.length ? prevSkills : filteredSkills;

  if (!shouldRender || (renderedSkills && !renderedSkills.length)) {
    return undefined;
  }

  const className = buildClassName(
    styles.root,
    'composer-tooltip custom-scroll',
    transitionClassNames,
  );

  return (
    <div className={className} ref={containerRef}>
      {renderedSkills?.map((skill, index) => (
        <ListItem
          key={skill.id}
          className={buildClassName(styles.skillItem, 'skill-item-clickable scroll-item')}
          onClick={handleClick}
          clickArg={skill.id}
        >
          <div className={styles.skillInfo}>
            <span className={styles.skillTag}>
              /
              {skill.name}
            </span>
            <span className={styles.skillContext}>{skill.context}</span>
          </div>
        </ListItem>
      ))}
    </div>
  );
};

export default memo(SkillTooltip);
