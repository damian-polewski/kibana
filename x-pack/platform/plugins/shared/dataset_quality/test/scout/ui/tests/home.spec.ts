/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { tags } from '@kbn/scout';
import { expect } from '@kbn/scout/ui';

import { test } from '../fixtures';
import { getInitialTestLogs } from '../../common';

const TO = '2024-01-01T12:00:00.000Z';

test.describe(
  'Dataset quality home',
  { tag: [...tags.stateful.classic, ...tags.serverless.observability.complete] },
  () => {
    test.beforeEach(async ({ browserAuth }) => {
      await browserAuth.loginAsAdmin();
    });

    test.afterAll(async ({ logsSynthtraceEsClient }) => {
      await logsSynthtraceEsClient.clean();
    });

    // Each test seeds (or clears) its own data rather than sharing a `beforeAll`,
    // so the empty-state case cannot be broken by the order tests run in.
    test('shows the empty state when no data sets exist', async ({
      pageObjects,
      logsSynthtraceEsClient,
    }) => {
      await logsSynthtraceEsClient.clean();

      await pageObjects.datasetQuality.goto();

      await expect(pageObjects.datasetQuality.noDataEmptyState).toBeVisible();
    });

    test('shows the data sets table once data exists', async ({
      pageObjects,
      logsSynthtraceEsClient,
    }) => {
      await logsSynthtraceEsClient.index(getInitialTestLogs({ to: TO, count: 1 }));

      await pageObjects.datasetQuality.goto();

      await expect(pageObjects.datasetQuality.table).toBeVisible();
      expect(await pageObjects.datasetQuality.getRowCount()).toBeGreaterThan(0);
    });
  }
);
