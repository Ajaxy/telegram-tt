import type { ChangeEvent } from 'react';
import { memo, useEffect, useRef, useState } from '../../../../lib/teact/teact';

import type { OrganizationMember } from '../../../services/types';

import buildClassName from '../../../../util/buildClassName';

import useOldLang from '../../../../hooks/useOldLang';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import AvatarEditable from '../../../../components/ui/AvatarEditable';
import FloatingActionButton from '../../../../components/ui/FloatingActionButton';
import InputText from '../../../../components/ui/InputText';
import ListItem from '../../../../components/ui/ListItem';
import TextArea from '../../../../components/ui/TextArea';
import MembersList from './MembersList';

import styles from './TelebizOrganizations.module.scss';

const ERROR_ORGANIZATION_NAME_MISSING = 'Please provide your organization name';
const ERROR_NO_MEMBERS = 'Please add at least one member to your organization';

const TelebizOrganizationsForm = ({
  id,
  isLoading,
  logoUrl,
  handleLogoUrlChange,
  name,
  handleNameChange,
  description,
  handleDescriptionChange,
  members,
  handleAddMembersClick,
  isSaveButtonShown,
  handleOrganizationPay,
}: {
  id: number;
  isLoading: boolean;
  logoUrl: string;
  handleLogoUrlChange: (file: File) => void;
  name: string;
  handleNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  description: string;
  handleDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  members: Partial<OrganizationMember>[];
  handleAddMembersClick: () => void;
  isSaveButtonShown: boolean;
  handleOrganizationPay: () => void;
}) => {
  const lang = useTelebizLang();
  const tgLang = useOldLang();
  const [error, setError] = useState<string | undefined>();
  const textAreaRef = useRef<HTMLTextAreaElement>();

  useEffect(() => {
    console.log('members form', members);
  }, [members]);

  useEffect(() => {
    console.log('name form', name);
  }, [name]);

  return (
    <div className="settings-fab-wrapper">
      <div className={buildClassName('custom-scroll', styles.form)}>
        <div className="settings-item">
          <div className="settings-input">
            <AvatarEditable
              currentAvatarBlobUrl={logoUrl}
              onChange={handleLogoUrlChange}
              title="Edit your organization logo"
              disabled={isLoading}
            />
            <InputText
              value={name}
              onChange={handleNameChange}
              label={lang('Organization Name (required)')}
              disabled={isLoading}
              error={error === ERROR_ORGANIZATION_NAME_MISSING ? error : undefined}
            />
            <TextArea
              key={id}
              label={lang('Description (optional)')}
              value={description || ''}
              onChange={handleDescriptionChange}
              disabled={isLoading}
              maxLength={200}
              maxLengthIndicator={(200 - (description?.length || 0)).toString()}
            />
          </div>

          <p className="settings-item-description" dir={tgLang.isRtl ? 'rtl' : undefined}>
            {lang('You can provide an optional description for your organization.')}
          </p>
        </div>
        <div className="settings-item">
          {error === ERROR_NO_MEMBERS && (
            <p className="settings-item-description color-danger mb-2" dir={tgLang.isRtl ? 'rtl' : undefined}>
              {lang(error)}
            </p>
          )}

          <h4 className="settings-item-header mb-3" dir={tgLang.isRtl ? 'rtl' : undefined}>{lang('Members')}</h4>

          <div className="members-list">
            <MembersList members={members} />
          </div>

          <ListItem
            withPrimaryColor
            icon="add-user"
            narrow
            onClick={handleAddMembersClick}
          >
            {lang('Manage Members')}
          </ListItem>

        </div>

        {/* <div className="settings-item">
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
        </div> */}

      </div>
      <FloatingActionButton
        isShown={isSaveButtonShown}
        onClick={handleOrganizationPay}
        disabled={isLoading}
        ariaLabel={tgLang('Save')}
        iconName="arrow-right"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(TelebizOrganizationsForm);
