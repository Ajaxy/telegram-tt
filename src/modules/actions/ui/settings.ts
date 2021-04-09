import { addReducer } from '../../../lib/teact/teactn';
import { ISettings } from '../../../types';
import { replaceSettings } from '../../reducers';

addReducer('setSettingOption', (global, actions, payload?: Partial<ISettings>) => {
  return replaceSettings(global, payload);
});
