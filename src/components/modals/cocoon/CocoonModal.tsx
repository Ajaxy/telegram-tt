import { memo, useMemo } from '@teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import Link from '../../ui/Link';
import ParticlesHeader from '../common/ParticlesHeader';
import TableAboutModal, { type TableAboutData } from '../common/TableAboutModal';

import styles from './CocoonModal.module.scss';

export type OwnProps = {
  modal: TabState['isCocoonModalOpen'];
};

const CocoonModal = ({ modal }: OwnProps) => {
  const { closeCocoonModal, openTelegramLink } = getActions();
  const isOpen = Boolean(modal);

  const lang = useLang();

  const handleClose = useLastCallback(() => {
    closeCocoonModal();
  });

  const openLinkAndClose = useLastCallback((url: string) => {
    openTelegramLink({ url });
    handleClose();
  });

  const listItemData = useMemo(() => {
    const feature1Description = lang('CocoonFeature1Text', {
      username: (
        <Link
          isPrimary
          onClick={() => {
            openLinkAndClose(lang('CocoonFeature1UsernameLink'));
          }}
        >
          {lang('CocoonFeature1Username')}
        </Link>
      ),
    }, { withNodes: true, withMarkdown: true });

    const feature3Description = lang('CocoonFeature3Text', {
      link: <SafeLink url={lang('CocoonFeature3Link')} text={lang('CocoonFeature3LinkText')} />,
    }, {
      withNodes: true,
      withMarkdown: true,
    });

    return [
      ['lock', lang('CocoonFeature1Title'), feature1Description],
      ['stats', lang('CocoonFeature2Title'), lang('CocoonFeature2Text')],
      ['gift', lang('CocoonFeature3Title'), feature3Description],
    ] satisfies TableAboutData;
  }, [lang]);

  const header = useMemo(() => {
    return (
      <ParticlesHeader
        className={styles.header}
        modelClassName={styles.egg}
        model="ai-egg"
        color="purple"
        title={lang('CocoonTitle')}
        description={lang('CocoonDescription', undefined, { withNodes: true, withMarkdown: true })}
      />
    );
  }, [lang]);

  const footer = useMemo(() => {
    return (
      <div className={styles.footer}>
        <span className={styles.footerText}>
          {lang('CocoonFooterText', {
            link: (
              <Link isPrimary onClick={() => openLinkAndClose(lang('CocoonFooterLink'))}>
                {lang('CocoonFooterLinkText')}
              </Link>
            ),
          }, { withNodes: true, withMarkdown: true })}
        </span>
        <Button iconName="understood" onClick={handleClose}>
          {lang('ButtonUnderstood')}
        </Button>
      </div>
    );
  }, [lang]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      onClose={closeCocoonModal}
      listItemData={listItemData}
      withSeparator
      header={header}
      footer={footer}
    />
  );
};

export default memo(CocoonModal);
