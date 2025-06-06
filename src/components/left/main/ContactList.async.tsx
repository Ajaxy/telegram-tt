import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './ContactList';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const ContactListAsync: FC<OwnProps> = (props) => {
  const ContactList = useModuleLoader(Bundles.Extra, 'ContactList');

  return ContactList ? <ContactList {...props} /> : <Loading />;
};

export default ContactListAsync;
