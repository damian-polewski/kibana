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
  PACKAGES,
  PRODUCTION_NAMESPACE,
  datasetNames,
  getInitialTestLogs,
  getLogsForDataset,
  indexLogs,
} from '../../common';

const TO = '2024-01-01T12:00:00.000Z';
/**
 * The quality column is computed over the page's selected time range, so the
 * malformed documents that make a data set report "Poor" have to be recent —
 * a fixed past timestamp leaves every data set looking "Good".
 */
const ACTIVE_TO = new Date().toISOString();
const APACHE_ACCESS_DATASET = 'apache.access';
/** The integration supplies a display name, which is what the table renders. */
const APACHE_ACCESS_DISPLAY_NAME = 'Apache access logs';
const APACHE_INTEGRATION_NAME = 'Apache HTTP Server';

const ALL_DATASET_NAMES = [APACHE_ACCESS_DISPLAY_NAME, ...datasetNames];

// The logs-essentials tier is deliberately not tagged here: the FTR suite only ran a
// single types-filter assertion there, which lives in logs_essentials_filters.spec.ts.
test.describe(
  'Dataset quality table filters',
  { tag: [...tags.stateful.classic, ...tags.serverless.observability.complete] },
  () => {
    // The data is only read by these tests, so it is seeded once for the file.
    // Filter state does not need resetting between tests: each Scout test runs in a
    // fresh browser context, unlike the FTR suite where it leaked across `it` blocks.
    test.beforeAll(async ({ apiServices, logsSynthtraceEsClient }) => {
      await apiServices.fleet.integration.installPackage(
        PACKAGES.apache.name,
        PACKAGES.apache.version
      );

      await indexLogs(logsSynthtraceEsClient, [
        getInitialTestLogs({ to: TO, count: 4 }),
        // Malformed docs make this dataset report "Poor" quality.
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

    test('shows full data set names when toggled', async ({ pageObjects }) => {
      await expect
        .poll(async () => pageObjects.datasetQuality.getDatasetNames())
        .toStrictEqual(ALL_DATASET_NAMES);

      await pageObjects.datasetQuality.toggleShowFullDatasetNames();

      // Toggled on, each cell shows the display name above the raw data set name.
      const expectedWithRawNames = [
        `${APACHE_ACCESS_DISPLAY_NAME}\n${APACHE_ACCESS_DATASET}`,
        ...datasetNames.map((name) => `${name}\n${name}`),
      ];
      await expect
        .poll(async () => pageObjects.datasetQuality.getDatasetNames())
        .toStrictEqual(expectedWithRawNames);
    });

    test('searches the data sets', async ({ pageObjects }) => {
      await pageObjects.datasetQuality.search(datasetNames[2]);

      await expect
        .poll(async () => pageObjects.datasetQuality.getDatasetNames())
        .toStrictEqual([datasetNames[2]]);
    });

    test('filters for an integration', async ({ pageObjects }) => {
      await pageObjects.datasetQuality.filterForIntegrations([APACHE_INTEGRATION_NAME]);

      await expect
        .poll(async () => pageObjects.datasetQuality.getDatasetNames())
        .toStrictEqual([APACHE_ACCESS_DISPLAY_NAME]);
    });

    test('filters for a namespace', async ({ pageObjects }) => {
      expect(
        await pageObjects.datasetQuality.getColumnValues(testData.TABLE_COLUMNS.namespace)
      ).toContain(PRODUCTION_NAMESPACE);

      await pageObjects.datasetQuality.filterForNamespaces([PRODUCTION_NAMESPACE]);

      await expect
        .poll(async () =>
          pageObjects.datasetQuality.getColumnValues(testData.TABLE_COLUMNS.namespace)
        )
        .toStrictEqual([PRODUCTION_NAMESPACE]);
    });

    test('filters for a quality', async ({ pageObjects }) => {
      const expectedQuality = testData.TEXTS.qualityPoor;

      expect(
        await pageObjects.datasetQuality.getColumnValues(testData.TABLE_COLUMNS.quality)
      ).toContain(expectedQuality);

      await pageObjects.datasetQuality.filterForQualities([expectedQuality]);

      await expect
        .poll(async () =>
          pageObjects.datasetQuality.getColumnValues(testData.TABLE_COLUMNS.quality)
        )
        .toStrictEqual([expectedQuality]);
    });
  }
);
