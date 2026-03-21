<script lang="ts">
  import { getActions } from '../../../global';
  import { globalStore } from '../../../global/store.svelte';
  import Button from '../../ui/svelte/Button.svelte';
  import InputText from '../../ui/svelte/InputText.svelte';
  import Loading from '../../ui/svelte/Loading.svelte';

  const auth = $derived(globalStore.state.auth);
  let password = $state('');
  let showPassword = $state(false);

  function handleChangePasswordVisibility(isVisible: boolean) {
    showPassword = isVisible;
  }

  function handleSubmit() {
    if (!password || auth.isLoading) return;
    getActions().setAuthPassword({ password });
  }

  function clearAuthErrorKey() {
    getActions().clearAuthErrorKey();
  }
</script>

<div id="auth-password-form" class="custom-scroll">
  <div class="auth-form">
    <!-- <MonkeyPassword isPasswordVisible={showPassword} /> -->
    <div class="monkey-password-placeholder"></div>
    
    <h1>Enter a Password</h1> <!-- Translation needed -->
    <p class="note">Your account is protected with an additional password.</p>

    <div class="password-form">
      <InputText
        id="sign-in-password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        value={password}
        error={auth.errorKey ? String(auth.errorKey) : undefined}
        onchange={(e) => {
          if (auth.errorKey) clearAuthErrorKey();
          password = (e.target as HTMLInputElement).value;
        }}
      />

      {#if auth.hint}
        <p class="hint">Hint: {auth.hint}</p>
      {/if}

      <div class="password-actions">
        <Button isText onclick={() => handleChangePasswordVisibility(!showPassword)}>
          {showPassword ? 'Hide password' : 'Show password'}
        </Button>
        <Button className="auth-button" ripple onclick={handleSubmit} isLoading={auth.isLoading}>
          CONTINUE
        </Button>
      </div>

      {#if auth.isLoading}
        <Loading />
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  /* Inherits styles from Auth.scss already included in parent */
  .monkey-password-placeholder {
    height: 120px;
    width: 120px;
    margin: 0 auto;
  }

  .password-form {
    width: 100%;
  }

  .password-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  .hint {
    margin: 0.75rem 0 0;
    color: #666;
    font-size: 0.9rem;
  }
</style>
