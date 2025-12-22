import { memo, type TeactNode } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import buildClassName from '../../../util/buildClassName';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import Separator from '../../ui/Separator';

import styles from './TableAboutModal.module.scss';

export type TableAboutData = [IconName | undefined, TeactNode, TeactNode][];

type OwnProps = {
  className?: string;
  contentClassName?: string;
  isOpen?: boolean;
  listItemData?: TableAboutData;
  headerIconName?: IconName;
  headerIconPremiumGradient?: boolean;
  header?: TeactNode;
  footer?: TeactNode;
  buttonText?: TeactNode;
  hasBackdrop?: boolean;
  withSeparator?: boolean;
  onClose: NoneToVoidFunction;
  onButtonClick?: NoneToVoidFunction;
};

const TableAboutModal = ({
  className,
  isOpen,
  listItemData,
  headerIconName,
  headerIconPremiumGradient,
  header,
  footer,
  buttonText,
  hasBackdrop,
  withSeparator,
  contentClassName,
  onClose,
  onButtonClick,
}: OwnProps) => {
  return (
    <Modal
      isOpen={isOpen}
      className={buildClassName(styles.root, className)}
      contentClassName={buildClassName(styles.content, contentClassName)}
      hasAbsoluteCloseButton
      absoluteCloseButtonColor={hasBackdrop ? 'translucent-white' : undefined}
      onClose={onClose}
    >
      {headerIconName && (
        <div className={buildClassName(styles.topIcon, headerIconPremiumGradient && styles.premiumGradient)}>
          <Icon name={headerIconName} />
        </div>
      )}
      {header}
      <div>
        {listItemData?.map(([icon, title, subtitle]) => {
          return (
            <ListItem
              isStatic
              multiline
              icon={icon}
              className={styles.listItem}
            >
              <span className={buildClassName('title', styles.listItemTitle)}>{title}</span>
              <span className="subtitle">{subtitle}</span>
            </ListItem>
          );
        })}
      </div>
      {withSeparator && <Separator className={styles.separator} />}
      {footer}
      {Boolean(buttonText) && (
        <Button onClick={onButtonClick || onClose}>{buttonText}</Button>
      )}
    </Modal>
  );
};

export default memo(TableAboutModal);
