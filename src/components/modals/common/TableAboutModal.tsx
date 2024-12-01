import React, { memo, type TeactNode } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import Separator from '../../ui/Separator';

import styles from './TableAboutModal.module.scss';

export type TableAboutData = [IconName | undefined, TeactNode, TeactNode][];

type OwnProps = {
  isOpen?: boolean;
  listItemData?: TableAboutData;
  headerIconName: IconName;
  header?: TeactNode;
  footer?: TeactNode;
  buttonText?: string;
  onClose: NoneToVoidFunction;
  onButtonClick?: NoneToVoidFunction;
};

const TableAboutModal = ({
  isOpen,
  listItemData,
  headerIconName,
  header,
  footer,
  buttonText,
  onClose,
  onButtonClick,
}: OwnProps) => {
  return (
    <Modal
      isOpen={isOpen}
      className={styles.root}
      contentClassName={styles.content}
      onClose={onClose}
    >
      <div className={styles.topIcon}><Icon name={headerIconName} /></div>
      {header}
      <div>
        {listItemData?.map(([icon, title, subtitle]) => {
          return (
            <ListItem
              isStatic
              multiline
              icon={icon}
            >
              <span className="title">{title}</span>
              <span className="subtitle">{subtitle}</span>
            </ListItem>
          );
        })}
      </div>
      <Separator className={styles.separator} />
      {footer}
      {buttonText && (
        <Button size="smaller" onClick={onButtonClick || onClose}>{buttonText}</Button>
      )}
    </Modal>
  );
};

export default memo(TableAboutModal);
