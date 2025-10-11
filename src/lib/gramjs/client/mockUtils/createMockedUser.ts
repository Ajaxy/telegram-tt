import type { MockTypes } from './MockTypes';

import Api from '../../tl/api';

export default function createMockedUser(id: string, mockData: MockTypes): Api.User {
  const user = mockData.users.find((u) => u.id === id);

  if (!user) throw Error('No such user ' + id);

  const {
    firstName = 'John',
    lastName = 'Doe',
    accessHash = 1n,
    ...rest
  } = user;

  return new Api.User({
    ...rest,
    id: BigInt(id),
    firstName,
    lastName,
    accessHash,
  });
}
