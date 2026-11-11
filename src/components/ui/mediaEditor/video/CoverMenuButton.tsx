import { memo, useRef } from '@teact';

import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../common/icons/Icon';
import Menu from '../../Menu';
import MenuItem from '../../MenuItem';

import styles from '../MediaEditor.module.scss';

type OwnProps = {
  isHidden?: boolean;
  coverThumbUrl?: string;
  hasCover: boolean;
  onChooseFile: (file: File) => void;
  onUseCurrentFrame: NoneToVoidFunction;
  onClear: NoneToVoidFunction;
};

function CoverMenuButton({
  isHidden,
  coverThumbUrl,
  hasCover,
  onChooseFile,
  onUseCurrentFrame,
  onClear,
}: OwnProps) {
  const lang = useLang();
  const inputRef = useRef<HTMLInputElement>();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();

  const handleChooseFromComputer = useLastCallback(() => {
    inputRef.current?.click();
  });

  const handleFileChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onChooseFile(file);
  });

  return (
    <div
      className={buildClassName(styles.coverMenuWrapper, isHidden && styles.hidden)}
      aria-hidden={isHidden}
      inert={isHidden}
    >
      <button type="button" className={styles.coverPill} onClick={openMenu}>
        {coverThumbUrl ? (
          <img className={styles.coverPillThumb} src={coverThumbUrl} alt="" />
        ) : (
          <Icon name="media" className={styles.coverPillIcon} />
        )}
        {lang('EditorSetCover')}
        <Icon name="down" className={styles.coverPillChevron} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.coverFileInput}
        onChange={handleFileChange}
      />
      <Menu
        isOpen={isMenuOpen}
        autoClose
        positionX="left"
        positionY="bottom"
        onClose={closeMenu}
      >
        <MenuItem icon="attach" onClick={handleChooseFromComputer}>
          {lang('EditorChooseCoverFromComputer')}
        </MenuItem>
        <MenuItem icon="media" onClick={onUseCurrentFrame}>
          {lang('EditorUseFrameAsCover')}
        </MenuItem>
        {hasCover && (
          <MenuItem icon="delete" destructive onClick={onClear}>
            {lang('EditorClearCover')}
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}

export default memo(CoverMenuButton);
