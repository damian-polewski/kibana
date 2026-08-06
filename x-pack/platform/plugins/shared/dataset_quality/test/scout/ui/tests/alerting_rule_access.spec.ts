/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { tags } from '@kbn/scout';
import { expect } from '@kbn/scout/ui';

import { test } from '../fixtures';
import {
  buildDataStreamName,
  canManageAlertsRole,
  canManageRulesRole,
  deleteDataStreamIfExists,
  getLogsForDataset,
} from '../../common';

/** Owned by this spec, so the privilege suites cannot disturb it. */
const DATASET = 'alertacc.logs';
const DATA_STREAM = buildDataStreamName({ dataset: DATASET });
const TO = '2024-01-01T12:00:00.000Z';

/**
 * The "create rule" button in the list page header shares its test subject with
 * the "Open in Discover" button on the details page, so it is matched inline
 * rather than through the details page object.
 */
const CREATE_RULE_BUTTON = 'datasetQualityDetailsHeaderButton';

// Stateful only: both scenarios hinge on a custom role, and the serverless FTR
// mirror of the neighbouring privileges suite carried an unexplained `failsOnMKI`
// tag, so serverless coverage is deliberately deferred until it can be verified
// against a real Observability serverless project.
test.describe('Dataset quality alerting rule access', { tag: tags.stateful.classic }, () => {
  test.beforeAll(async ({ logsSynthtraceEsClient }) => {
    await logsSynthtraceEsClient.index(getLogsForDataset({ to: TO, count: 4, dataset: DATASET }));
  });

  test.afterAll(async ({ esClient, log }) => {
    await deleteDataStreamIfExists(esClient, DATA_STREAM, log);
  });

  test('hides the create rule button from a user who can only manage alerts', async ({
    browserAuth,
    page,
    pageObjects,
  }) => {
    await browserAuth.loginWithCustomRole(canManageAlertsRole);

    await pageObjects.datasetQuality.goto();

    await expect(page.testSubj.locator(CREATE_RULE_BUTTON)).toBeHidden();
  });

  test('shows the create rule button to a user who can manage rules', async ({
    browserAuth,
    page,
    pageObjects,
  }) => {
    await browserAuth.loginWithCustomRole(canManageRulesRole);

    await pageObjects.datasetQuality.goto();

    await expect(page.testSubj.locator(CREATE_RULE_BUTTON)).toBeVisible();
  });
});
