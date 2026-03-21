<script lang="ts">
  import buildClassName from '../../../util/buildClassName';
  import styles from '../MenuSeparator.module.scss';

  interface Props {
    className?: string;
    size?: 'thin' | 'thick';
  }

  let { className, size = 'thin' }: Props = $props();

  const fullClassName = $derived(buildClassName(styles.root, styles[size], className));
</script>

<div class={fullClassName}></div>

<style lang="scss">
  /* Original styles are likely global or in a shared file, but we can add local tweaks if needed */
</style>
