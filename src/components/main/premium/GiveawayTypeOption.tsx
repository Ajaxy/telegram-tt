import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/Icon';

import styles from './GiveawayTypeOption.module.scss';

type ApiGiveawayType = 'random_users' | 'specific_users';

type OwnProps = {
  option: ApiGiveawayType;
  name: string;
  text: string;
  img: string;
  checked?: boolean;
  isLink: boolean;
  className?: string;
  onChange: (value: ApiGiveawayType) => void;
  onClickAction?: () => void;
  userNames?: string;
  selectedMemberIds?: string[];
};

const GiveawayTypeOption: FC<OwnProps> = ({
  option, checked,
  name, text, img,
  isLink, onChange, onClickAction, className,
  userNames, selectedMemberIds,
}) => {
  const lang = useLang();

  let displayText: string | undefined = lang(text);
  if (isLink && selectedMemberIds?.length) {
    displayText = selectedMemberIds.length > 2 ? `${selectedMemberIds.length}` : userNames;
  }

  const handleChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onChange(option);
    }
  });

  const handleClick = useLastCallback(() => {
    onClickAction?.();
  });

  return (
    <label
      className={buildClassName(styles.wrapper, className)}
      dir={lang.isRtl ? 'rtl' : undefined}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <input
        className={styles.input}
        type="radio"
        name="giveaway_option"
        value={option}
        checked={checked}
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
      />
      <div className={styles.content}>
        <img className={styles.optionImg} src={img} alt="" draggable={false} />
        <div className={styles.giveaway}>
          <h3 className={styles.title}>
            {lang(`${name}`)}
          </h3>
          {isLink ? (
            <div className={styles.link}>
              <span>{displayText}</span>
              <Icon name="next" />
            </div>
          ) : (
            <span className={styles.contentText}>{displayText}</span>
          )}
        </div>
      </div>
    </label>
  );
};

export default memo(GiveawayTypeOption);
