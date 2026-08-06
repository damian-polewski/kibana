/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { tags } from '@kbn/scout';
import { expect } from '@kbn/scout/ui';

import { test, testData } from '../fixtures';
import {
  DEFAULT_NAMESPACE,
  PACKAGES,
  PRODUCTION_NAMESPACE,
  datasetNames,
  getInitialTestLogs,
  getLogsForDataset,
  indexLogs,
} from '../../common';

const TO = '2024-01-01T12:00:00.000Z';
/** Recent enough that the data set counts as active in the default time range. */
const ACTIVE_TO = new Date().toISOString();
const APACHE_ACCESS_DATASET = 'apache.access';
const APACHE_ACCESS_DISPLAY_NAME = 'Apache access logs';

test.describe(
  'Dataset quality table',
  { tag: [...tags.stateful.classic, ...tags.serverless.observability.complete] },
  () => {
    // Read-only data, so it is seeded once for the whole file. Failure-store
    // scenarios live in failure_store.spec.ts, which owns that cluster state.
    test.beforeAll(async ({ apiServices, logsSynthtraceEsClient }) => {
      await apiServices.fleet.integration.installPackage(
        PACKAGES.apache.name,
        PACKAGES.apache.version
      );

      await indexLogs(logsSynthtraceEsClient, [
        getInitialTestLogs({ to: TO, count: 4 }),
        // Only malformed docs, so this data set reports 100% degraded and is active.
        getLogsForDataset({
          to: ACTIVE_TO,
          count: 1,
          dataset: datasetNames[2],
          isMalformed: true,
        }),
        getLogsForDataset({
          to: TO,
          count: 10,
          dataset: APACHE_ACCESS_DATASET,
          namespace: PRODUCTION_NAMESPACE,
        }),
      ]);
    });

    test.beforeEach(async ({ browserAuth, pageObjects }) => {
      await browserAuth.loginAsAdmin();
      await pageObjects.datasetQuality.goto();
    });

    test.afterAll(async ({ apiServices, logsSynthtraceEsClient }) => {
      await logsSynthtraceEsClient.clean();
      await apiServices.fleet.integration.delete(PACKAGES.apache.name);
    });

    test('sorts by data set name and shows the namespace', async ({ pageObjects }) => {
      await pageObjects.datasetQuality.sortBy(testData.TABLE_COLUMNS.name, 'descending');

      const names = await pageObjects.datasetQuality.getDatasetNames();
      // The Apache data set sorts last because the integration renames it.
      expect(names).toStrictEqual([...[...datasetNames].reverse(), APACHE_ACCESS_DISPLAY_NAME]);

      expect(
        await pageObjects.datasetQuality.getColumnValues(testData.TABLE_COLUMNS.namespace)
      ).toStrictEqual([
        DEFAULT_NAMESPACE,
        DEFAULT_NAMESPACE,
        DEFAULT_NAMESPACE,
        PRODUCTION_NAMESPACE,
      ]);
    });

    test('shows last activity only for data sets with recent data', async ({ pageObjects }) => {
      const rows = await pageObjects.datasetQuality.parseTable();
      const activityByDataset = new Map(
        rows.map((row) => [
          row[testData.TABLE_COLUMNS.name],
          row[testData.TABLE_COLUMNS.lastActivity],
        ])
      );

      // Only datasetNames[2] was ingested inside the default time range.
      expect(activityByDataset.get(datasetNames[2])).not.toBe(testData.TEXTS.noActivity);
      expect(activityByDataset.get(datasetNames[0])).toBe(testData.TEXTS.noActivity);
      expect(activityByDataset.get(APACHE_ACCESS_DISPLAY_NAME)).toBe(testData.TEXTS.noActivity);
    });

    test('renders the degraded docs percentage per data set', async ({ pageObjects }) => {
      const rows = await pageObjects.datasetQuality.parseTable();
      const degradedByDataset = new Map(
        rows.map((row) => [
          row[testData.TABLE_COLUMNS.name],
          row[testData.TABLE_COLUMNS.degradedDocs],
        ])
      );

      // Exact degraded document counts are asserted by the API suite; this covers
      // that the count is rendered as a percentage in the right column.
      expect(degradedByDataset.get(datasetNames[2])).toBe('100%');
      expect(degradedByDataset.get(datasetNames[0])).toBe('0%');
    });

    test('shows the data set name supplied by the integration', async ({ pageObjects }) => {
      expect(await pageObjects.datasetQuality.getDatasetNames()).toContain(
        APACHE_ACCESS_DISPLAY_NAME
      );
    });

    test('opens the data set in Discover', async ({ page, pageObjects }) => {
      await pageObjects.datasetQuality.getOpenInDiscoverLink(datasetNames[0]).click();

      await expect.poll(async () => page.url()).toContain('/app/discover');
    });

    test('hides inactive data sets when toggled', async ({ pageObjects }) => {
      const rows = await pageObjects.datasetQuality.parseTable();
      const activeCount = rows.filter(
        (row) => row[testData.TABLE_COLUMNS.lastActivity] !== testData.TEXTS.noActivity
      ).length;

      // Without at least one active data set the assertion below would hold whatever the
      // toggle did, so the seeded state is checked before relying on it.
      expect(activeCount).toBeGreaterThan(0);
      expect(activeCount).toBeLessThan(rows.length);

      await pageObjects.datasetQuality.toggleShowInactiveDatasets();

      await expect.poll(async () => pageObjects.datasetQuality.getRowCount()).toBe(activeCount);
    });

    // Only the formatting is asserted, not a non-zero value: the reported size comes
    // from store statistics that refresh on their own schedule, so a freshly seeded
    // data set legitimately still reads "0.0 B" — and serverless does not expose the
    // `_stats` API behind it at all (elastic/kibana#178954). That makes the assertion
    // valid on both deployments. (The FTR assertion looked stricter but was vacuous:
    // it compared against '0.0 KB', which '0.0 B' already satisfies.)
    test('renders a formatted size for every data set', async ({ pageObjects }) => {
      const sizes = await pageObjects.datasetQuality.getColumnValues(testData.TABLE_COLUMNS.size);

      expect(sizes.length).toBeGreaterThan(0);
      for (const size of sizes) {
        expect(size).toMatch(/^\d+(\.\d+)? (B|KB|MB|GB|TB)$/);
      }
    });
  }
);
