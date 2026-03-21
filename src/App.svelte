<script lang="ts">
  import Auth from './components/auth/svelte/Auth.svelte';
  import LeftColumn from './components/left/svelte/LeftColumn.svelte';
  import MiddleColumn from './components/middle/svelte/MiddleColumn.svelte';
  import RightColumn from './components/right/svelte/RightColumn.svelte';
  import { globalStore } from './global/store.svelte';
  import { selectTabState, selectTheme } from './global/selectors';
  import { getTranslationFn } from './util/localization';

  const authState = $derived(globalStore.state.auth.state);
  const tabState = $derived(selectTabState(globalStore.state));
  const theme = $derived(selectTheme(globalStore.state));
  const inactiveReason = $derived(tabState?.inactiveReason);
  const isScreenLocked = $derived(Boolean(globalStore.state.passcode.isScreenLocked));
  const lang = getTranslationFn();

  const activeScreen = $derived.by(() => {
    if (inactiveReason) return 'inactive';
    if (isScreenLocked) return 'lock';
    if (authState === 'authorizationStateReady') return 'main';
    return 'auth';
  });
</script>

<main class:theme-light={theme === 'light'} class:theme-dark={theme === 'dark'}>
  {#if activeScreen === 'auth'}
    <Auth />
  {:else if activeScreen === 'lock'}
    <div class="state-screen">{lang('Passcode')}</div>
  {:else if activeScreen === 'inactive'}
    <div class="state-screen">
      {lang(inactiveReason === 'auth' ? 'AppInactiveAuthTitle' : 'AppInactiveOtherClientTitle')}
    </div>
  {:else}
    <div class="app-container">
      <LeftColumn />
      <MiddleColumn />
      <RightColumn />
    </div>
  {/if}
</main>

<style lang="scss">
  /* Global CSS should be imported or managed here */
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: Roboto, -apple-system, BlinkMacSystemFont, "Apple Color Emoji", "Segoe UI", Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  }
  
  main {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .theme-light {
    color-scheme: light;
  }

  .theme-dark {
    color-scheme: dark;
  }

  .app-container {
    display: flex;
    width: 100%;
    height: 100%;
  }

  .state-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 1rem;
  }
</style>
