import type { OwnProps } from './ContactList';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const ContactListAsync = (props: OwnProps) => {
  const ContactList = useModuleLoader(Bundles.Extra, 'ContactList');

  return ContactList ? <ContactList {...props} /> : <Loading />;
};

export default ContactListAsync;
