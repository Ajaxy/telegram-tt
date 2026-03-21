<script lang="ts">
  import { globalStore } from '../../../global/store.svelte';
  import { IS_TAURI } from '../../../util/browser/globalEnvironment';
  import { IS_MAC_OS, PLATFORM_ENV } from '../../../util/browser/windowEnvironment';
  
  import AuthPhoneNumber from './AuthPhoneNumber.svelte';
  import AuthCode from './AuthCode.svelte';
  import AuthPassword from './AuthPassword.svelte';
  // import AuthQrCode from './AuthQrCode.svelte';
  // import AuthRegister from './AuthRegister.svelte';

  const authState = $derived(globalStore.state.auth.state);
  const isMobile = PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android';

  // Simplified version of the transition logic for now
  const activeComponent = $derived.by(() => {
    switch (authState) {
      case 'authorizationStateWaitCode': return AuthCode;
      case 'authorizationStateWaitPassword': return AuthPassword;
      // case 'authorizationStateWaitRegistration': return AuthRegister;
      case 'authorizationStateWaitPhoneNumber': return AuthPhoneNumber;
      // case 'authorizationStateWaitQrCode': return AuthQrCode;
      default: return isMobile ? AuthPhoneNumber : AuthPhoneNumber; // Placeholder for QrCode
    }
  });
</script>

<div class="Auth fade" data-tauri-drag-region={IS_TAURI && IS_MAC_OS ? true : undefined}>
  <!-- Transition component placeholder -->
  <activeComponent></activeComponent>
</div>

<style lang="scss">
  @import "../Auth.scss";
  
  .fade {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
