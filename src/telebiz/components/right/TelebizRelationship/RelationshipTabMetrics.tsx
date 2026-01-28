import { memo } from '@teact';

import styles from './TelebizRelationship.module.scss';

export interface MetricItem {
  label: string;
  value: string | number;
  color?: 'red' | 'green';
}

export interface Metrics {
  items: MetricItem[][];
  title?: string;
}

interface OwnProps {
  metrics: Metrics;
}

const RelationshipTabMetrics = ({ metrics }: OwnProps) => {
  return (
    <section className={styles.section}>
      {metrics.title ? <h4 className={styles.sectionTitle}>{metrics.title}</h4> : undefined}
      <div className={styles.metrics}>
        {metrics.items.map((row, index) => (
          <div className={styles.metricsRow} key={index}>
            {row.map((metric: MetricItem) => (
              <div className={styles.metric}>
                <span>{metric.label}</span>
                <b className={styles[`${metric.color}Text`]}>{metric.value}</b>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

export default memo(RelationshipTabMetrics);
