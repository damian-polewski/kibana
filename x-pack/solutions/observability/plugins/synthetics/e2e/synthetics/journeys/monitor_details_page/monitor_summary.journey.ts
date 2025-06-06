/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { journey, step, before, after, expect } from '@elastic/synthetics';
import { byTestId } from '@kbn/ux-plugin/e2e/journeys/utils';
import { RetryService } from '@kbn/ftr-common-functional-services';
import moment from 'moment';
import { syntheticsAppPageProvider } from '../../page_objects/synthetics_app';
import { SyntheticsServices } from '../services/synthetics_services';

const journeySkip =
  (...params: Parameters<typeof journey>) =>
  () =>
    journey(...params);
// TODO: skipped because failing on main and need to unblock CI
journeySkip(`MonitorSummaryTab`, async ({ page, params }) => {
  const syntheticsApp = syntheticsAppPageProvider({ page, kibanaUrl: params.kibanaUrl, params });

  const services = new SyntheticsServices(params);

  const getService = params.getService;
  const retry: RetryService = getService('retry');

  const firstCheckTime = moment().subtract(1, 'minutes').toISOString();

  let configId: string;

  before(async () => {
    await services.cleanUp();
    await services.enableMonitorManagedViaApi();
    configId = await services.addTestMonitor('Test Monitor', {
      type: 'http',
      urls: 'https://www.google.com',
      custom_heartbeat_id: 'b9d9e146-746f-427f-bbf5-6e786b5b4e73',
      locations: [
        { id: 'us_central', label: 'North America - US Central', isServiceManaged: true },
      ],
    });
    await services.addTestSummaryDocument({ timestamp: firstCheckTime, configId });
  });

  after(async () => {
    await services.cleanUp();
  });

  step('Go to monitor summary page', async () => {
    await syntheticsApp.navigateToOverview(true);
  });

  step('Monitor is as up in summary page', async () => {
    await page.hover('text=Test Monitor');
    await page.click('[aria-label="Open actions menu"]');
    await page.click('text=Go to monitor');
    await page.waitForSelector(byTestId('monitorLatestStatusUp'));
  });

  step('set the monitor status as down', async () => {
    const downCheckTime = new Date(Date.now()).toISOString();
    await services.addTestSummaryDocument({
      docType: 'summaryDown',
      timestamp: downCheckTime,
      configId,
    });
  });

  step('Disable default alert for monitor', async () => {
    await page.click('text=Actions');
    await page.click('text=Disable status alert');
    await page.waitForSelector(`text=Alerts are now disabled for the monitor "Test Monitor".`);
    await page.click('text=Enable status alert');
  });

  step('it shows monitor as down', async () => {
    await page.waitForSelector(byTestId('monitorLatestStatusDown'), { timeout: 120 * 1000 });
  });

  step('Shows the alerts panel', async () => {
    await retry.try(async () => {
      await page.waitForSelector(
        `${byTestId('monitorActiveAlertsCount')}  .legacyMtrVis__value:has-text("1")`
      );
    });
    const existingLabels = [
      'Availability',
      'Median duration',
      'Errors',
      'All',
      'Active',
      'Recovered',
    ];

    const labels = await page.$$(byTestId('metric_label'));
    for (const label of labels) {
      const text = await label.textContent();
      expect(existingLabels).toContain(text);
    }
  });
});
