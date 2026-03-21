<script lang="ts">
  import type { ApiPeer } from '../../../api/types';
  import type { IconName } from '../../../types/icons';
  import buildClassName from '../../../util/buildClassName';
  import renderText from '../../common/helpers/renderText';
  import { globalStore } from '../../../global/store.svelte';
  
  import Icon from '../../common/icons/svelte/Icon.svelte';
  import Button from './Button.svelte';
  import Checkbox from './Checkbox.svelte';
  import Spinner from './Spinner.svelte';
  // import Avatar from '../../common/Avatar.svelte'; // TODO

  interface IRadioOption {
    label: string;
    value: string;
    subLabel?: string;
  }

  interface Props {
    id?: string;
    name?: string;
    value?: string;
    peer?: ApiPeer;
    label?: any;
    labelText?: any;
    subLabel?: string;
    checked?: boolean;
    rightIcon?: IconName;
    disabled?: boolean;
    tabIndex?: number;
    withIcon?: boolean;
    blocking?: boolean;
    permissionGroup?: boolean;
    isLoading?: boolean;
    onlyInput?: boolean;
    isRound?: boolean;
    className?: string;
    nestedCheckbox?: boolean;
    nestedCheckboxCount?: number;
    nestedOptionList?: IRadioOption[];
    leftElement?: any;
    values?: string[];
    onchange?: (e: Event, nestedOptionList?: IRadioOption[]) => void;
    oncheck?: (isChecked: boolean) => void;
    onclicklabel?: (e: MouseEvent, value?: string) => void;
  }

  let {
    id,
    name,
    value,
    label,
    peer,
    labelText,
    subLabel,
    checked,
    tabIndex,
    disabled,
    withIcon,
    blocking,
    permissionGroup,
    isLoading,
    className,
    rightIcon,
    onlyInput,
    isRound,
    nestedCheckbox,
    nestedCheckboxCount,
    nestedOptionList,
    leftElement,
    values,
    onchange,
    oncheck,
    onclicklabel
  }: Props = $props();

  let showNested = $state(false);

  // Simplified version of useLang
  const isRtl = $derived(globalStore.state.sharedState?.settings?.language === 'ar' || globalStore.state.sharedState?.settings?.language === 'fa');

  function handleChange(e: Event) {
    if (disabled) return;
    const target = e.target as HTMLInputElement;
    onchange?.(e, nestedOptionList);
    oncheck?.(target.checked);
  }

  function toggleNested() {
    showNested = !showNested;
  }

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'LABEL') {
      onclicklabel?.(e, value);
    }
  }

  function handleInputClick(e: MouseEvent) {
    e.stopPropagation();
  }

  const labelClassName = $derived(buildClassName(
    'Checkbox',
    disabled && 'disabled',
    withIcon && 'withIcon',
    isLoading && 'loading',
    blocking && 'blocking',
    nestedCheckbox && 'nested',
    subLabel && 'withSubLabel',
    permissionGroup && 'permission-group',
    Boolean(leftElement) && 'avatar',
    onlyInput && 'onlyInput',
    isRound && 'round',
    Boolean(rightIcon) && 'withNestedList',
    className,
  ));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<label
  class={labelClassName}
  dir={isRtl ? 'rtl' : undefined}
  onclick={onclicklabel ? handleClick : undefined}
>
  <input
    type="checkbox"
    {id}
    {name}
    {value}
    {checked}
    {disabled}
    tabindex={tabIndex}
    onchange={handleChange}
    onclick={onclicklabel ? handleInputClick : undefined}
  />  <div class={buildClassName('Checkbox-main', Boolean(leftElement) && 'Nested-avatar-list')}>
    <div class={buildClassName('user-avatar', peer && 'user-avatar-visible')}>
      {#if peer}
        <!-- <Avatar {peer} size={20} /> -->
        <div class="placeholder-avatar"></div>
      {/if}
    </div>
    <span class="label" dir="auto">
      {#if leftElement} {@render leftElement()} {/if}
      {#if typeof label === 'string'}
        {@html renderText(label)}
      {:else if label}
        {@render label()}
      {/if}
      {#if labelText}
        <span class="ml-1">{@html renderText(labelText)}</span>
      {/if}
    </span>
    {#if subLabel}
      <span class="subLabel" dir="auto">{@html renderText(subLabel)}</span>
    {/if}
    {#if rightIcon}
      <Icon name={rightIcon} className="right-icon" />
    {/if}
  </div>

  {#if nestedCheckbox}
    <span class="nestedButton" dir="auto">
      <Button className="button" color="translucent" size="smaller" onclick={toggleNested}>
        <Icon name="group-filled" className="group-icon" />
        {nestedCheckboxCount}
        <Icon name={showNested ? 'up' : 'down'} />
      </Button>
    </span>
  {/if}

  {#if isLoading}
    <Spinner />
  {/if}
</label>

{#if nestedCheckbox}
  <div class={buildClassName('nested-checkbox-group', showNested && 'nested-checkbox-group-open')}>
    {#if nestedOptionList}
      {#each nestedOptionList as nestedOption}
        <Checkbox
          leftElement={leftElement}
          onchange={onchange}
          checked={values?.indexOf(nestedOption.value) !== -1}
          {values}
          {...nestedOption}
        />
      {/each}
    {/if}
  </div>
{/if}

<style lang="scss">
  @import "../Checkbox.scss";
  
  .placeholder-avatar {
    width: 20px;
    height: 20px;
    background: #ccc;
    border-radius: 50%;
  }
</style>
