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
  buildDataStreamName,
  deleteDataStreamIfExists,
  fullAccessRoleWithIndices,
  getLogsForDataset,
  noDatasetQualityAccessRole,
} from '../../common';

/** Owned by this spec, so the other privilege suites cannot disturb it. */
const DATASET = 'privno.logs';
const DATA_STREAM = buildDataStreamName({ dataset: DATASET });
const TO = '2024-01-01T12:00:00.000Z';

// Stateful only: every scenario here hinges on a custom role, and the serverless
// FTR mirror carried an unexplained `failsOnMKI` tag, so serverless coverage is
// deliberately deferred until it can be verified against a real Observability
// serverless project.
test.describe('Dataset quality privileges - no access', { tag: tags.stateful.classic }, () => {
  // Seeded with the privileged synthtrace client so the empty states below prove a
  // privilege problem rather than an empty cluster.
  test.beforeAll(async ({ logsSynthtraceEsClient }) => {
    await logsSynthtraceEsClient.index(getLogsForDataset({ to: TO, count: 4, dataset: DATASET }));
  });

  test.afterAll(async ({ esClient, log }) => {
    await deleteDataStreamIfExists(esClient, DATA_STREAM, log);
  });

  test('shows the management home when the user has no Data Quality privileges', async ({
    browserAuth,
    page,
  }) => {
    await browserAuth.loginWithCustomRole(noDatasetQualityAccessRole);

    await page.gotoApp(testData.DATA_QUALITY_APP_PATH);

    // The no-privileges empty state cannot be asserted here: without the app
    // privilege the Data Set Quality route is never registered, so the management
    // landing page is all that renders.
    await expect(page.testSubj.locator('managementHome')).toBeVisible();
  });

  test('shows the no-privileges empty state when the user cannot monitor any data set', async ({
    browserAuth,
    page,
    pageObjects,
  }) => {
    // App access, but not a single index privilege.
    await browserAuth.loginWithCustomRole(fullAccessRoleWithIndices([]));

    // The table is not rendered at all in this state, so the list page object's
    // `goto` (which waits for the table) cannot be used here.
    await page.gotoApp(testData.DATA_QUALITY_APP_PATH);

    await expect(pageObjects.datasetQuality.noPrivilegesEmptyState).toBeVisible();

    // Data exists and is simply invisible to this user, so the app must blame
    // privileges instead of claiming there is no data.
    await expect(pageObjects.datasetQuality.noDataEmptyState).toBeHidden();
  });
});
