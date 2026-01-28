import { memo, useState } from '@teact';

import type { OrganizationMember } from '../../../services/types';

import buildClassName from '../../../../util/buildClassName';

import useOldLang from '../../../../hooks/useOldLang';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Avatar from '../../../../components/common/Avatar';
import SafeLink from '../../../../components/common/SafeLink';
import Checkbox from '../../../../components/ui/Checkbox';
import FloatingActionButton from '../../../../components/ui/FloatingActionButton';

import styles from './TelebizOrganizations.module.scss';

const ERROR_TERMS_AND_CONDITIONS = 'Please accept the terms and conditions';

const TelebizOrganizationsPayment = ({
  isLoading,
  logoUrl,
  name,
  description,
  members,
  handleOrganizationSave,
}: {
  isLoading: boolean;
  logoUrl: string;
  name: string;
  description: string;
  members: Partial<OrganizationMember>[];
  handleOrganizationSave: () => void;
}) => {
  const lang = useTelebizLang();
  const tgLang = useOldLang();
  const [isTosAccepted, setIsTosAccepted] = useState(false);
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="settings-fab-wrapper">
      <div className={buildClassName('custom-scroll', styles.form)}>
        <div className="settings-item">
          <div className="settings-input">
            <div className={styles.organizationInfo}>
              <Avatar
                previewUrl={logoUrl}
                text={name}
              />
              <div className={styles.organizationInfoDetails}>
                <div>
                  {name}
                </div>
                <div className={styles.organizationInfoDetailsDescription}>
                  {description}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="settings-item">
          <div className={styles.summaryMembers} dir={tgLang.isRtl ? 'rtl' : undefined}>
            <div className={styles.summaryMembersInner}>
              <div className={styles.summaryMembersTitle}>
                {members.length}
                {' '}
                {lang('members')}
              </div>
              <div className={styles.summaryMembersDetails}>
                <div className={styles.summaryMembersDetailsPrice}>
                  $100.00 / seat
                </div>
                <div className={styles.summaryMembersDetailsPriceDiscount}>
                  $0.00
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-item">
          <h4 className="settings-item-header mb-3" dir={tgLang.isRtl ? 'rtl' : undefined}>{lang('Terms and Conditions')}</h4>
          {error === ERROR_TERMS_AND_CONDITIONS && (
            <p className="settings-item-description color-danger mb-2" dir={tgLang.isRtl ? 'rtl' : undefined}>
              {lang(error)}
            </p>
          )}
          <Checkbox
            label={(
              <>
                {lang('I accept the')}
                {' '}
                <SafeLink
                  url={lang('https://www.google.com')}
                  text={lang('terms and conditions')}
                />
              </>
            )}
            name="organization_tos"
            checked={Boolean(isTosAccepted)}
            className={styles.tosCheckbox}
            tabIndex={0}
            onCheck={(isChecked) => {
              if (isChecked) {
                setError(undefined);
              }
              setIsTosAccepted(isChecked);
            }}
          />
        </div>

      </div>
      {error && error !== ERROR_TERMS_AND_CONDITIONS && (
        <div
          className={styles.error}
          dir={tgLang.isRtl ? 'rtl' : undefined}
        >
          {lang(error)}
        </div>
      )}
      <FloatingActionButton
        isShown
        onClick={() => {
          if (isTosAccepted) {
            handleOrganizationSave();
          } else {
            setError(lang('Please accept the terms and conditions'));
          }
        }}
        disabled={isLoading}
        ariaLabel={tgLang('Save')}
        iconName="check"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(TelebizOrganizationsPayment);
