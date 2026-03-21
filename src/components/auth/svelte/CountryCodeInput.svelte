<script lang="ts">
  import { globalStore } from '../../../global/store.svelte';
  import type { ApiCountryCode } from '../../../api/types';
  import buildClassName from '../../../util/buildClassName';
  import { isoToEmoji } from '../../../util/emoji/emoji';
  import { prepareSearchWordsForNeedle } from '../../../util/searchWords';
  import renderText from '../../common/helpers/renderText';

  import DropdownMenu from '../../ui/svelte/DropdownMenu.svelte';
  import MenuItem from '../../ui/svelte/MenuItem.svelte';
  import Spinner from '../../ui/svelte/Spinner.svelte';

  interface Props {
    id: string;
    value?: ApiCountryCode;
    isLoading?: boolean;
    onchange: (value: ApiCountryCode) => void;
  }

  let { id, value, isLoading, onchange }: Props = $props();

  const phoneCodeList = $derived(globalStore.state.countryList.phoneCodes || []);
  let filter = $state<string | undefined>(undefined);
  
  const filteredList = $derived(getFilteredList(phoneCodeList, filter));

  function getFilteredList(countryList: ApiCountryCode[], filterVal = ''): ApiCountryCode[] {
    if (!filterVal.length) return countryList;
    const searchWords = prepareSearchWordsForNeedle(filterVal);
    return countryList.filter((country) => (
      searchWords(country.defaultName) || (country.name && searchWords(country.name))
    ));
  }

  function updateFilter(filterValue?: string) {
    filter = filterValue;
  }

  function handleChange(country: ApiCountryCode) {
    onchange(country);
    setTimeout(() => updateFilter(undefined), 200);
  }

  function handleInput(e: Event) {
    updateFilter((e.target as HTMLInputElement).value);
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Backspace') return;
    const target = e.currentTarget as HTMLInputElement;
    if (value && filter === undefined) {
      target.value = '';
    }
    updateFilter(target.value);
  }

  const emoji = $derived(value && isoToEmoji(value.iso2));
  const name = $derived(value?.name || value?.defaultName || '');
  const inputValue = $derived(filter ?? [emoji, name].filter(Boolean).join(' '));
</script>

<DropdownMenu className="CountryCodeInput">
  {#snippet trigger({ onTrigger, isOpen }: { onTrigger: () => void; isOpen: boolean })}
    <div class={buildClassName('input-group', value && 'touched')}>
      <input
        class={buildClassName('form-control', isOpen && 'focus')}
        type="text"
        {id}
        value={inputValue}
        autocomplete="off"
        onclick={() => { onTrigger(); }}
        onfocus={() => { onTrigger(); }}
        oninput={(e) => { handleInput(e); onTrigger(); }}
        onkeydown={handleInputKeyDown}
      />
      <label for={id}>Country</label> <!-- Translation needed -->
      {#if isLoading}
        <Spinner color="black" />
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <i onclick={() => onTrigger()} class={buildClassName('css-icon-down', isOpen && 'open')}></i>
      {/if}
    </div>
  {/snippet}

  {#each filteredList as country (country.iso2 + '-' + country.countryCode)}
    <MenuItem
      className={value && country.iso2 === value.iso2 ? 'selected' : ''}
      onclick={() => handleChange(country)}
    >
      <span class="country-flag">{@html renderText(isoToEmoji(country.iso2), ['hq_emoji'])}</span>
      <span class="country-name">{country.name || country.defaultName}</span>
      <span class="country-code">+{country.countryCode}</span>
    </MenuItem>
  {/each}
  
  {#if filteredList.length === 0}
    <MenuItem disabled>
      <span>No results</span> <!-- Translation needed -->
    </MenuItem>
  {/if}
</DropdownMenu>

<style lang="scss">
  @import "../CountryCodeInput.scss";
</style>
