/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { tags } from '@kbn/scout';
import { expect } from '@kbn/scout/ui';

import { test } from '../fixtures';
import { buildDataStreamName, getLogsForDataset, indexLogs } from '../../common';

/**
 * Stateful-only, in its own file because Playwright merges describe and test tags: a
 * stateful-only tag on a single test inside a both-tagged describe still matches a
 * serverless run.
 *
 * This KPI is backed by the `_stats` API, which serverless does not expose
 * (elastic/kibana#178954) — it was observed reading 0 there. Note the API suite does
 * assert a non-zero `sizeBytes` on both deployments: that value comes from the metering
 * API, which is a different source and does work on serverless. The two are not in
 * conflict.
 *
 * See details_navigation.spec.ts for the rest of the overview KPI coverage.
 */
const DATASET = 'synth.detailssize';
const DATA_STREAM = buildDataStreamName({ dataset: DATASET });
const TO = '2024-01-01T12:00:00.000Z';
const TIME_RANGE = {
  from: '2024-01-01T00:00:00.000Z',
  to: '2024-01-02T00:00:00.000Z',
  refresh: { pause: true, value: 0 },
};

test.describe('Dataset quality details size KPI', { tag: tags.stateful.classic }, () => {
  test.beforeAll(async ({ logsSynthtraceEsClient }) => {
    await indexLogs(logsSynthtraceEsClient, [
      getLogsForDataset({ to: TO, count: 15, dataset: DATASET }),
    ]);
  });

  test.beforeEach(async ({ browserAuth }) => {
    await browserAuth.loginAsAdmin();
  });

  test.afterAll(async ({ logsSynthtraceEsClient }) => {
    await logsSynthtraceEsClient.clean();
  });

  test('renders a non-zero size for the data set', async ({ pageObjects }) => {
    await pageObjects.datasetQualityDetails.goto({
      dataStream: DATA_STREAM,
      timeRange: TIME_RANGE,
    });

    // The metering stats API is cached, so poll rather than reading once.
    await expect
      .poll(async () => parseFloat(await pageObjects.datasetQualityDetails.getSizeKpi()))
      .toBeGreaterThan(0);
  });
});
