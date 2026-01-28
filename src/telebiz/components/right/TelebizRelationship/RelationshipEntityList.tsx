import { memo } from '@teact';

import type { ProviderEntityWithType } from './EntityCard';

import EntityCard from './EntityCard';

import styles from './TelebizRelationship.module.scss';

interface OwnProps {
  items: ProviderEntityWithType[];
  title?: string;
}

const RelationshipEntityList = ({ items, title }: OwnProps) => {
  return (
    <section className={styles.section}>
      {title ? <h4 className={styles.sectionTitle}>{title}</h4> : undefined}
      <div className={styles.itemList}>
        {items.map((item) => (
          <EntityCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
};

export default memo(RelationshipEntityList);
