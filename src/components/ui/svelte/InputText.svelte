<script lang="ts">
  import { globalStore } from '../../../global/store.svelte';
  import buildClassName from '../../../util/buildClassName';
  import { IS_TAURI } from '../../../util/browser/globalEnvironment';

  interface Props {
    id?: string;
    className?: string;
    value?: string;
    label?: string;
    error?: string;
    success?: string;
    disabled?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    autoComplete?: string;
    maxLength?: number;
    tabIndex?: number;
    inputMode?: 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
    onchange?: (e: Event) => void;
    oninput?: (e: Event) => void;
    onkeypress?: (e: KeyboardEvent) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    onblur?: (e: FocusEvent) => void;
    onpaste?: (e: ClipboardEvent) => void;
    onclick?: (e: MouseEvent) => void;
  }

  let {
    id,
    className,
    value = '',
    label,
    error,
    success,
    disabled,
    readOnly,
    placeholder,
    autoComplete,
    inputMode,
    maxLength,
    tabIndex,
    onchange,
    oninput,
    onkeypress,
    onkeydown,
    onblur,
    onpaste,
    onclick
  }: Props = $props();

  const isRtl = $derived(globalStore.state.sharedState?.settings?.language === 'ar' || globalStore.state.sharedState?.settings?.language === 'fa');
  const labelText = $derived(error || success || label);
  
  const fullClassName = $derived(buildClassName(
    'input-group',
    value && 'touched',
    error ? 'error' : success && 'success',
    disabled && 'disabled',
    readOnly && 'disabled',
    labelText && 'with-label',
    className,
  ));

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    oninput?.(e);
  }
</script>

<div class={fullClassName} dir={isRtl ? 'rtl' : undefined}>
  <input
    class="form-control"
    type="text"
    {id}
    dir="auto"
    {value}
    tabindex={tabIndex}
    {placeholder}
    maxlength={maxLength}
    // @ts-ignore
    autocomplete={autoComplete}
    spellcheck={IS_TAURI ? false : undefined}
    inputmode={inputMode}
    {disabled}
    readonly={readOnly}
    onchange={onchange}
    oninput={handleInput}
    onkeypress={onkeypress}
    onkeydown={onkeydown}
    onblur={onblur}
    onpaste={onpaste}
    onclick={onclick}
    aria-label={labelText}
    />
  {#if labelText}
    <label for={id}>{labelText}</label>
  {/if}
</div>

<style lang="scss">
  /* Original styles are likely global or in a shared file, but we can add local tweaks if needed */
  :global(.input-group) {
    position: relative;
    margin-bottom: 1.5rem;
    
    .form-control {
      display: block;
      width: 100%;
      padding: 0.5rem 0;
      font-size: 1rem;
      border: none;
      border-bottom: 1px solid #ccc;
      background: transparent;
      outline: none;
      transition: border-color 0.2s;

      &:focus {
        border-bottom-color: #0088cc;
      }
    }

    label {
      position: absolute;
      top: 0.5rem;
      left: 0;
      color: #999;
      transition: all 0.2s;
      pointer-events: none;
    }

    &.touched label, .form-control:focus + label {
      top: -1rem;
      font-size: 0.8rem;
      color: #0088cc;
    }
  }
</style>
