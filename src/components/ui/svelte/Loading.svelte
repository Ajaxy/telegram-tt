<script lang="ts">
  import buildClassName from '../../../util/buildClassName';
  import Spinner from './Spinner.svelte';

  interface Props {
    color?: 'blue' | 'white' | 'black' | 'yellow';
    backgroundColor?: 'light' | 'dark';
    className?: string;
    onclick?: () => void;
  }

  let {
    color = 'blue',
    backgroundColor,
    className,
    onclick
  }: Props = $props();

  const fullClassName = $derived(buildClassName('Loading', onclick && 'interactive', className));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class={fullClassName} onclick={onclick}>
  <Spinner {color} {backgroundColor} />
</div>

<style lang="scss">
  @import "../Loading.scss";
</style>
