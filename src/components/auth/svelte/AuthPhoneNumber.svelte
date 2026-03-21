<script lang="ts">
  import { getActions } from '../../../global';
  import { globalStore } from '../../../global/store.svelte';
  import type { ApiCountryCode } from '../../../api/types';
  import { formatPhoneNumber, getCountryCodeByIso, getCountryFromPhoneNumber } from '../../../util/phoneNumber';

  import Button from '../../ui/svelte/Button.svelte';
  import Checkbox from '../../ui/svelte/Checkbox.svelte';
  import InputText from '../../ui/svelte/InputText.svelte';
  import Loading from '../../ui/svelte/Loading.svelte';
  import CountryCodeInput from './CountryCodeInput.svelte';

  const MIN_NUMBER_LENGTH = 7;

  let country = $state<ApiCountryCode | undefined>();
  let phoneNumber = $state<string | undefined>('');
  let isTouched = $state(false);
  
  // Destructure state
  const auth = $derived(globalStore.state.auth);
  const connectionState = $derived(globalStore.state.connectionState);
  const phoneCodeList = $derived(globalStore.state.countryList.phoneCodes);
  
  const isConnected = $derived(connectionState === 'connectionStateReady');
  const fullNumber = $derived(country ? `+${country.countryCode} ${phoneNumber || ''}` : phoneNumber);
  const canSubmit = $derived(fullNumber && fullNumber.replace(/[^\d]+/g, '').length >= MIN_NUMBER_LENGTH);
  const isAuthReady = $derived(auth.state === 'authorizationStateWaitPhoneNumber');

  $effect(() => {
    if (isConnected && !auth.nearestCountry) {
      getActions().loadNearestCountry();
    }
    if (isConnected) {
      getActions().loadCountryList({});
    }
  });

  $effect(() => {
    if (auth.nearestCountry && phoneCodeList && !country && !isTouched) {
      country = getCountryCodeByIso(phoneCodeList, auth.nearestCountry);
    }
  });

  function parseFullNumber(newFullNumber: string) {
    if (!newFullNumber.length) {
      phoneNumber = '';
    }

    const suggestedCountry = phoneCodeList && getCountryFromPhoneNumber(phoneCodeList, newFullNumber);

    const selectedCountry = !country
      || (suggestedCountry && suggestedCountry.iso2 !== country.iso2)
      || (!suggestedCountry && newFullNumber.length)
      ? suggestedCountry
      : country;

    if (!country || !selectedCountry || (selectedCountry && selectedCountry.iso2 !== country.iso2)) {
      country = selectedCountry;
    }
    phoneNumber = formatPhoneNumber(newFullNumber, selectedCountry);
  }

  function handleCountryChange(value: ApiCountryCode) {
    country = value;
    phoneNumber = '';
  }

  function handlePhoneNumberChange(e: Event) {
    const target = e.target as HTMLInputElement;
    isTouched = true;
    parseFullNumber(target.value);
  }

  function handleKeepSessionChange(isChecked: boolean) {
    getActions().setAuthRememberMe({ value: isChecked });
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (auth.isLoading || !canSubmit) return;

    getActions().setAuthPhoneNumber({ phoneNumber: fullNumber! });
  }
</script>

<div id="auth-phone-number-form" class="custom-scroll">
  <div class="auth-form">
    <div id="logo"></div>
    <h1>Sign In</h1> <!-- Translate -->
    <p class="note">Please confirm your country code and enter your phone number.</p>
    
    <form class="form" onsubmit={(e) => { e.preventDefault(); handleSubmit(e); }}>
      <CountryCodeInput
        id="sign-in-phone-code"
        value={country}
        isLoading={!auth.nearestCountry && !country}
        onchange={handleCountryChange}
      />
      
      <InputText
        id="sign-in-phone-number"
        label="Phone Number"
        value={fullNumber}
        error={auth.errorKey ? String(auth.errorKey) : undefined}
        inputMode="tel"
        onchange={handlePhoneNumberChange}
      />
      
      <Checkbox
        id="sign-in-keep-session"
        label="Keep me signed in"
        checked={Boolean(auth.rememberMe)}
        oncheck={handleKeepSessionChange}
      />
      
      {#if canSubmit}
        {#if isAuthReady}
          <Button
            className="auth-button"
            type="submit"
            ripple
            isLoading={auth.isLoading}
          >
            NEXT
          </Button>
        {:else}
          <Loading />
        {/if}
      {/if}
      
      {#if isAuthReady}
        <Button
          className="auth-button"
          isText
          ripple
          isLoading={auth.isLoadingQrCode}
          onclick={() => getActions().goToAuthQrCode()}
        >
          LOG IN BY QR CODE
        </Button>
      {/if}
    </form>
  </div>
</div>
