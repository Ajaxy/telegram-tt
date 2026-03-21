<script lang="ts">
  import { getActions } from '../../../global';
  import { globalStore } from '../../../global/store.svelte';
  import Icon from '../../common/icons/svelte/Icon.svelte';
  import InputText from '../../ui/svelte/InputText.svelte';
  import Loading from '../../ui/svelte/Loading.svelte';

  const CODE_LENGTH = 5;

  let code = $state('');
  let isTracking = $state(false);
  let trackingDirection = $state(1);

  // Derived global state
  const auth = $derived(globalStore.state.auth);
  const phoneNumber = $derived(auth.phoneNumber);
  const isCodeViaApp = $derived(auth.isCodeViaApp);
  const isLoading = $derived(auth.isLoading);
  const errorKey = $derived(auth.errorKey);

  function handleReturnToAuthPhoneNumber() {
    getActions().returnToAuthPhoneNumber();
  }

  function onCodeChange(e: Event) {
    if (errorKey) {
      getActions().clearAuthErrorKey();
    }

    const target = e.target as HTMLInputElement;
    const nextCode = target.value.replace(/[^\d]+/g, '').slice(0, CODE_LENGTH);
    target.value = nextCode;

    if (nextCode === code) return;

    trackingDirection = nextCode.length >= code.length ? 1 : -1;
    code = nextCode;

    if (!isTracking) {
      isTracking = true;
    } else if (!nextCode.length) {
      isTracking = false;
    }

    if (nextCode.length === CODE_LENGTH) {
      getActions().setAuthCode({ code: nextCode });
    }
  }
</script>

<div id="auth-code-form" class="custom-scroll">
  <div class="auth-form">
    <!-- TrackingMonkey component is omitted/mocked for now, needs rlottie -->
    <div class="tracking-monkey-placeholder"></div>
    
    <h1>
      {phoneNumber}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="auth-number-edit div-button"
        onclick={handleReturnToAuthPhoneNumber}
        role="button"
        tabindex="0"
        title="Wrong number"
        aria-label="Wrong number"
      >
        <Icon name="edit" />
      </div>
    </h1>
    
    <p class="note">
      {isCodeViaApp ? 'We have sent a code to the Telegram app.' : 'We have sent a code via SMS.'}
    </p>
    
    <InputText
      id="sign-in-code"
      label="Code"
      oninput={onCodeChange}
      value={code}
      error={errorKey ? String(errorKey) : undefined}
      autoComplete="off"
      inputMode="numeric"
    />
    
    {#if isLoading}
      <Loading />
    {/if}
  </div>
</div>

<style lang="scss">
  /* Inherits styles from Auth.scss already included in parent */
  .tracking-monkey-placeholder {
    height: 120px;
    width: 120px;
    margin: 0 auto;
  }
</style>
