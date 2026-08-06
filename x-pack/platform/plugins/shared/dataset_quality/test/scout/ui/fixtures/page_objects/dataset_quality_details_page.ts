/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ScoutPage } from '@kbn/scout';
import rison from '@kbn/rison';

import {
  DEFAULT_QUALITY_ISSUE_SORT_DIRECTION,
  DEFAULT_QUALITY_ISSUE_SORT_FIELD,
} from '../../../../../common/constants';
import {
  DATA_QUALITY_DETAILS_APP_PATH,
  DATA_QUALITY_URL_STATE_KEY,
  QUALITY_ISSUE_COLUMNS,
} from '../constants';
import { normalizeCellText, normalizeHeaderText, selectSearchableOption } from './table_text';

interface DetailsPageState {
  dataStream: string;
  timeRange?: { from: string; to: string; refresh?: { pause: boolean; value: number } };
  /** Opens the flyout for this field directly from the URL. */
  expandedQualityIssue?: { name: string; type: 'degraded' | 'failed' };
  /** Toggles between current and historical quality issues. */
  showCurrentQualityIssues?: boolean;
  /** Selects which quality-issue chart the overview shows. */
  qualityIssuesChart?: 'degraded' | 'failed';
  /** `wired` and `classic` streams offer different mitigations. */
  view?: 'wired' | 'classic';
  breakdownField?: string;
}

/** KPIs rendered in the details page overview panel. */
export type DetailsSummaryKpi = Record<
  'docsCountTotal' | 'services' | 'hosts' | 'degradedDocs' | 'failedDocs',
  string
>;

/**
 * The Data Set Quality details page (`management/data/data_quality/details`).
 *
 * Methods return state (text, counts, locators); assertions belong in the specs.
 */
export class DatasetQualityDetailsPage {
  readonly container;
  readonly title;
  readonly headerButton;
  readonly emptyPrompt;
  readonly qualityIssuesTable;
  readonly qualityIssuesTableNoData;
  readonly degradedFieldFlyout;
  readonly linkToDiscover;
  readonly flyoutCloseButton;
  readonly currentQualityIssuesToggle;
  readonly integrationActionsButton;
  readonly editFailureStoreIcon;
  readonly enableFailureStoreButton;
  readonly failureStoreModal;
  readonly failureStoreModalSaveButton;
  readonly enableFailureStoreToggle;

  constructor(private readonly page: ScoutPage) {
    this.container = page.testSubj.locator('datasetDetailsContainer');
    this.title = page.testSubj.locator('datasetQualityDetailsTitle');
    this.headerButton = page.testSubj.locator('datasetQualityDetailsHeaderButton');
    this.emptyPrompt = page.testSubj.locator('datasetQualityDetailsEmptyPrompt');
    this.qualityIssuesTable = page.testSubj.locator('datasetQualityDetailsDegradedFieldTable');
    this.qualityIssuesTableNoData = page.testSubj.locator(
      'datasetQualityDetailsDegradedTableNoData'
    );
    this.degradedFieldFlyout = page.testSubj.locator('datasetQualityDetailsDegradedFieldFlyout');
    this.linkToDiscover = page.testSubj.locator('datasetQualityDetailsLinkToDiscover');
    this.flyoutCloseButton = page.testSubj.locator('euiFlyoutCloseButton');
    // Rendered as an EuiFilterButton with `isToggle`, so it reports state through
    // `aria-pressed` rather than the `switch` role.
    this.currentQualityIssuesToggle = page.testSubj.locator(
      'datasetQualityDetailsOverviewDegradedFieldToggleSwitch'
    );
    this.integrationActionsButton = page.testSubj.locator(
      'datasetQualityDetailsIntegrationActionsButton'
    );
    this.editFailureStoreIcon = page.testSubj.locator('datasetQualityDetailsEditFailureStore');
    this.enableFailureStoreButton = page.testSubj.locator(
      'datasetQualityDetailsEnableFailureStoreButton'
    );
    this.failureStoreModal = page.testSubj.locator('editFailureStoreModal');
    this.failureStoreModalSaveButton = page.testSubj.locator('failureStoreModalSaveButton');
    this.enableFailureStoreToggle = page.testSubj.locator('enableFailureStoreToggle');
  }

  /**
   * Builds the v2 URL state.
   *
   * `expandedQualityIssue`, `showCurrentQualityIssues` and `qualityIssuesChart` are
   * siblings of `qualityIssues`, not nested inside it — `qualityIssues` is decoded
   * with `rt.exact`, which silently strips anything but its `table` key. See
   * `dataset_quality_details_url_schema_v2.ts` in `@kbn/data-quality`.
   */
  private buildUrlParams({
    dataStream,
    timeRange,
    expandedQualityIssue,
    showCurrentQualityIssues,
    qualityIssuesChart,
    view,
    breakdownField,
  }: DetailsPageState) {
    const state = {
      v: 2,
      dataStream,
      ...(timeRange ? { timeRange } : {}),
      ...(view ? { view } : {}),
      ...(breakdownField ? { breakdownField } : {}),
      ...(expandedQualityIssue ? { expandedQualityIssue } : {}),
      ...(showCurrentQualityIssues === undefined ? {} : { showCurrentQualityIssues }),
      ...(qualityIssuesChart ? { qualityIssuesChart } : {}),
      qualityIssues: {
        table: {
          page: 0,
          rowsPerPage: 10,
          sort: {
            field: DEFAULT_QUALITY_ISSUE_SORT_FIELD,
            direction: DEFAULT_QUALITY_ISSUE_SORT_DIRECTION,
          },
        },
      },
    };

    return { [DATA_QUALITY_URL_STATE_KEY]: rison.encode(state) };
  }

  /**
   * Navigates to the details page and waits for it to settle on either the details
   * panel or the empty prompt — a data stream that does not exist renders the
   * prompt instead of the container, so waiting only for the container would hang.
   */
  async goto(pageState: DetailsPageState): Promise<void> {
    await this.page.gotoApp(DATA_QUALITY_DETAILS_APP_PATH, {
      params: this.buildUrlParams(pageState),
    });
    await this.container.or(this.emptyPrompt).waitFor({ state: 'visible' });
  }

  async waitUntilTableLoaded(): Promise<void> {
    await this.page.locator('.euiBasicTable-loading').waitFor({ state: 'detached' });
  }

  /**
   * Reads the overview KPIs.
   *
   * The `size` KPI is backed by the `_stats` API, which serverless does not expose
   * (elastic/kibana#178954) — read it with {@link getSizeKpi} from stateful-only tests.
   */
  async getSummaryKpis(): Promise<DetailsSummaryKpi> {
    const read = async (title: string) =>
      (
        await this.page.testSubj
          .locator(`datasetQualityDetailsSummaryKpiValue-${title}`)
          .innerText()
      ).trim();

    return {
      docsCountTotal: await read('Total count'),
      services: await read('Services'),
      hosts: await read('Hosts'),
      degradedDocs: await read('Degraded documents'),
      failedDocs: await read('Failed documents'),
    };
  }

  async getSizeKpi(): Promise<string> {
    return (
      await this.page.testSubj.locator('datasetQualityDetailsSummaryKpiValue-Size').innerText()
    ).trim();
  }

  getSummaryCard(title: 'Degraded documents' | 'Failed documents' | 'noFailureStore') {
    return this.page.testSubj.locator(`datasetQualityDetailsSummaryKpiCard-${title}`);
  }

  /** Switches the quality-issues chart between degraded and failed documents. */
  async selectQualityIssueChart(issue: 'degraded' | 'failed'): Promise<void> {
    const title = issue === 'degraded' ? 'Degraded documents' : 'Failed documents';
    await this.getSummaryCard(title).click();
  }

  getSparkPlots() {
    return this.page.testSubj.locator('datasetQualitySparkPlot');
  }

  async getQualityIssuesTableHeaderTexts(): Promise<string[]> {
    await this.waitUntilTableLoaded();
    return (await this.qualityIssuesTable.locator('thead th, thead td').allInnerTexts()).map(
      normalizeHeaderText
    );
  }

  getQualityIssueRows() {
    return this.qualityIssuesTable.locator('tbody tr');
  }

  async parseQualityIssuesTable(): Promise<Array<Record<string, string>>> {
    await this.waitUntilTableLoaded();
    const headers = await this.getQualityIssuesTableHeaderTexts();
    const rows = await this.getQualityIssueRows().all();

    return Promise.all(
      rows.map(async (row) => {
        const cells = await row.locator('td').allInnerTexts();
        return headers.reduce<Record<string, string>>((record, header, index) => {
          record[header] = normalizeCellText(cells[index] ?? '');
          return record;
        }, {});
      })
    );
  }

  async getQualityIssueNames(): Promise<string[]> {
    const rows = await this.parseQualityIssuesTable();
    return rows.map((row) => row[QUALITY_ISSUE_COLUMNS.name] ?? '');
  }

  async sortQualityIssuesBy(column: string, direction: 'ascending' | 'descending'): Promise<void> {
    const header = this.qualityIssuesTable.locator('thead th', { hasText: column });

    for (let click = 0; click < 2; click++) {
      if ((await header.getAttribute('aria-sort')) === direction) {
        return;
      }
      await header.getByRole('button').click();
      await this.waitUntilTableLoaded();
    }

    if ((await header.getAttribute('aria-sort')) !== direction) {
      throw new Error(`Could not sort quality issues by "${column}" ${direction}`);
    }
  }

  /**
   * Matches the field name exactly so lookups can't straddle two rows
   * (a substring match on `test_field` would also hit `test_field_2`).
   */
  getQualityIssueRow(fieldName: string) {
    return this.getQualityIssueRows().filter({
      has: this.page.getByText(fieldName, { exact: true }),
    });
  }

  /** Opens the flyout for a quality issue via its row expand button. */
  async openQualityIssueFlyout(fieldName: string): Promise<void> {
    await this.getQualityIssueRow(fieldName)
      .locator('[data-test-subj="datasetQualityDetailsQualityIssuesExpandButton"]')
      .click();
    await this.degradedFieldFlyout.waitFor({ state: 'visible' });
  }

  async closeFlyout(): Promise<void> {
    await this.flyoutCloseButton.click();
    await this.degradedFieldFlyout.waitFor({ state: 'detached' });
  }

  /** Waits for the flyout's mitigation section to finish loading. */
  async waitUntilMitigationsLoaded(): Promise<void> {
    await this.page
      .locator('.euiFlyoutBody .datasetQualityDetailsFlyoutManualMitigationsLoading')
      .waitFor({ state: 'detached' });
  }

  getFlyoutSection(testSubj: string) {
    return this.page.testSubj.locator(testSubj);
  }

  /**
   * Chooses the histogram breakdown field, or clears it when passed `null`.
   *
   * The search box is always used to narrow the list first, because the option list
   * is virtualised — an option that is scrolled out of view is not in the DOM at all.
   * Options are then picked by their `value` attribute rather than their label, since
   * the rendered text carries a screen-reader suffix and the "No breakdown" entry has
   * no field name. Waiting on `data-is-searching` avoids clicking mid-filter.
   */
  async selectBreakdownField(field: string | null): Promise<void> {
    const selectable = this.page.testSubj.locator('unifiedHistogramBreakdownSelectorSelectable');
    const searchTerm = field ?? 'No breakdown';
    const optionValue = field ?? '__EMPTY_SELECTOR_OPTION__';

    await this.page.testSubj.click('unifiedHistogramBreakdownSelectorButton');
    await selectable.waitFor({ state: 'visible' });

    await this.page.testSubj.fill('unifiedHistogramBreakdownSelectorSelectorSearch', searchTerm);
    await this.page
      .locator(
        '[data-test-subj="unifiedHistogramBreakdownSelectorSelectable"][data-is-searching="false"]'
      )
      .waitFor({ state: 'attached' });

    await selectable.locator(`.euiSelectableListItem[value="${optionValue}"]`).click();

    // Picking an option closes the popover, which is the signal the choice landed.
    await selectable.waitFor({ state: 'detached' });
  }

  async isCurrentQualityIssuesToggleChecked(): Promise<boolean> {
    return (await this.currentQualityIssuesToggle.getAttribute('aria-pressed')) === 'true';
  }

  async toggleCurrentQualityIssues(): Promise<void> {
    // The Lens chart above renders its hover actions ("View in Discover", its own
    // canvas) into a portal that sits over this control. Moving the pointer away is
    // not enough — the portal outlives the hover — so the actionability check is
    // bypassed deliberately. The button itself is visible and enabled; only a
    // decorative overlay is in the way. The FTR suite worked around the same thing
    // with three copy-pasted `moveMouseTo` calls.
    await this.currentQualityIssuesToggle.click({ force: true });
    await this.waitUntilTableLoaded();
  }

  async filterForIssueTypes(types: string[]): Promise<void> {
    await this.page.testSubj.click('datasetQualityDetailsIssueTypeSelectorButton');
    for (const type of types) {
      await selectSearchableOption(this.page, 'datasetQualityDetailsIssueTypeSelector', type);
    }
    await this.waitUntilTableLoaded();
  }

  async filterForFields(fields: string[]): Promise<void> {
    await this.page.testSubj.click('datasetQualityDetailsFieldSelectorButton');
    for (const field of fields) {
      await selectSearchableOption(this.page, 'datasetQualityDetailsFieldSelector', field);
    }
    await this.waitUntilTableLoaded();
  }

  async openIntegrationActionsMenu(): Promise<void> {
    await this.integrationActionsButton.click();
  }

  getIntegrationAction(action: 'Overview' | 'Template' | 'ViewDashboards') {
    return this.page.testSubj.locator(`datasetQualityDetailsIntegrationAction${action}`);
  }

  getIntegrationRow(field: 'integration' | 'version') {
    return this.page.testSubj.locator(`datasetQualityDetailsFieldsList-${field}`);
  }

  /** Opens the failure-store modal from the details summary card. */
  async openFailureStoreModal(): Promise<void> {
    await this.editFailureStoreIcon.click();
    await this.failureStoreModal.waitFor({ state: 'visible' });
  }

  async saveFailureStoreChanges(): Promise<void> {
    await this.failureStoreModalSaveButton.click();
    await this.failureStoreModal.waitFor({ state: 'detached' });
  }
}
