import { memo } from '../../../lib/teact/teact';

import type { RegularLangKey } from '../../../types/language';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import IconBackdrop from '../../gili/primitives/IconBackdrop';

import styles from './GiveawayTypeOption.module.scss';

type ApiGiveawayType = 'premium_giveaway' | 'stars_giveaway';

type OwnProps = {
  option: ApiGiveawayType;
  name: RegularLangKey;
  text: RegularLangKey;
  checked?: boolean;
  isLink: boolean;
  className?: string;
  userNames?: string;
  selectedMemberIds?: string[];
  onChange: (value: ApiGiveawayType) => void;
  onClickAction?: () => void;
};

const GiveawayTypeOption = ({
  option, checked,
  name, text,
  isLink, onChange, onClickAction, className,
  userNames, selectedMemberIds,
}: OwnProps) => {
  const lang = useLang();
  const isStars = option === 'stars_giveaway';

  let displayText: string | undefined = lang(text);
  if (isLink && selectedMemberIds?.length) {
    displayText = selectedMemberIds.length > 2 ? selectedMemberIds.length.toString() : userNames;
  }

  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        <IconBackdrop
          className={styles.optionIcon}
          color={isStars ? 'orange' : 'blue'}
          icon={isStars ? 'star' : 'gift-filled'}
        />
        <div className={styles.giveaway}>
          <h3 className={styles.title}>
            {lang(name)}
          </h3>
          {isLink ? (
            <div className={styles.link} onClick={handleClick}>
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
