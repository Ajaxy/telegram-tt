<script lang="ts">
  import { onMount } from 'svelte';
  
  interface Ripple {
    id: number;
    x: number;
    y: number;
    size: number;
  }

  let ripples = $state<Ripple[]>([]);
  const ANIMATION_DURATION_MS = 700;
  let nextId = 0;

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;

    const container = e.currentTarget as HTMLDivElement;
    const position = container.getBoundingClientRect();
    const rippleSize = container.offsetWidth / 2;

    const newRipple = {
      id: nextId++,
      x: e.clientX - position.left - (rippleSize / 2),
      y: e.clientY - position.top - (rippleSize / 2),
      size: rippleSize,
    };

    ripples.push(newRipple);

    setTimeout(() => {
      ripples = ripples.filter(r => r.id !== newRipple.id);
    }, ANIMATION_DURATION_MS);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ripple-container" onmousedown={handleMouseDown}>
  {#each ripples as { id, x, y, size } (id)}
    <div
      class="ripple-wave"
      style:left="{x}px"
      style:top="{y}px"
      style:width="{size}px"
      style:height="{size}px"
    ></div>
  {/each}
</div>

<style lang="scss">
  @import "../RippleEffect.scss";
</style>
