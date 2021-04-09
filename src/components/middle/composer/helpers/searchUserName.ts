import { ApiUser } from '../../../../api/types';
import { getUserFullName } from '../../../../modules/helpers';
import searchWords from '../../../../util/searchWords';

// TODO: Support cyrillic translit search
export default function searchUserName(filter: string, user: ApiUser) {
  const usernameLowered = user.username.toLowerCase();
  const fullName = getUserFullName(user);
  const fullNameLowered = fullName && fullName.toLowerCase();
  const filterLowered = filter.toLowerCase();

  return usernameLowered.startsWith(filterLowered) || (
    fullNameLowered && searchWords(fullNameLowered, filterLowered)
  );
}
