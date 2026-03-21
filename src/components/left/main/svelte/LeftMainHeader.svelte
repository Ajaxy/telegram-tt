<script lang="ts">
  import buildClassName from '../../../../util/buildClassName';
  import { getTranslationFn } from '../../../../util/localization';

  interface Props {
    shouldHideSearch?: boolean;
    content: number; // LeftColumnContent
    contactsFilter: string;
    shouldSkipTransition?: boolean;
    isClosingSearch?: boolean;
    isFoldersSidebarShown?: boolean;
    onSearchQuery: (query: string) => void;
    onReset: () => void;
  }

  let {
    shouldHideSearch,
    content,
    contactsFilter,
    shouldSkipTransition,
    isClosingSearch,
    isFoldersSidebarShown,
    onSearchQuery,
    onReset
  }: Props = $props();

  const lang = getTranslationFn();

</script>

<div class={buildClassName('LeftMainHeader', shouldHideSearch && 'hide-search')}>
  <div class="search-container">
    <input
      type="text"
      placeholder={lang('Search')}
      class="search-input"
      value={contactsFilter}
      oninput={(e) => onSearchQuery((e.target as HTMLInputElement).value)}
    />
  </div>
</div>

<style lang="scss">
  .LeftMainHeader {
    height: 56px;
    padding: 8px 16px;
    background: white;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;

    &.hide-search {
      display: none;
    }
  }

  .search-input {
    width: 100%;
    padding: 8px 16px;
    border: none;
    border-radius: 20px;
    background: #f1f1f1;
    outline: none;
  }
</style>
