<script lang="ts">
  import buildClassName from '../../../util/buildClassName';
  import styles from '../Spinner.module.scss';

  interface Props {
    color?: 'blue' | 'white' | 'black' | 'green' | 'gray' | 'yellow';
    backgroundColor?: 'light' | 'dark';
    className?: string;
  }

  let {
    color = 'blue',
    backgroundColor,
    className
  }: Props = $props();

  const fullClassName = $derived(buildClassName(
    'Spinner',
    styles.root,
    color && styles[color],
    backgroundColor && styles.withBackground,
    backgroundColor && styles[`${backgroundColor}Bg`],
    className,
  ));
</script>

<div class={fullClassName}>
  <div class={buildClassName('Spinner__inner', styles.inner)}></div>
</div>

<style lang="scss">
  /* Original Spinner component uses CSS Modules, so we rely on the JS object from scss file */
  /* If the build setup doesn't support importing SCSS as JS objects, we'll need to adapt */
</style>
