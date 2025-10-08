import { getGlobal, setGlobal } from '../../global';

import { APP_CODE_NAME, INTERCLIENT_BROADCAST_CHANNEL } from '../../config';
import { updateTabState } from '../../global/reducers/tabs';
import { selectTabState } from '../../global/selectors';

export default function listenOtherClients() {
  const channel = new BroadcastChannel(INTERCLIENT_BROADCAST_CHANNEL);

  channel.addEventListener('message', (event) => {
    if (event.data !== APP_CODE_NAME) {
      let global = getGlobal();
      const tabState = selectTabState(global);
      global = updateTabState(global, {
        inactiveReason: 'otherClient',
      }, tabState.id);
      setGlobal(global);
    }
  });

  channel.postMessage(APP_CODE_NAME);
}
