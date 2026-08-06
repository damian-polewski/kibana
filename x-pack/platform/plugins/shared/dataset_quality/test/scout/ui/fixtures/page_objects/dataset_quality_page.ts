/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ScoutPage } from '@kbn/scout';
import rison from '@kbn/rison';

import { DATA_QUALITY_APP_PATH, DATA_QUALITY_URL_STATE_KEY, TABLE_COLUMNS } from '../constants';
import { normalizeCellText, normalizeHeaderText, selectOptionByText } from './table_text';

interface ListPageState {
  v?: number;
  table?: { page?: number; sort?: { field: string; direction: string } };
  filters?: Record<string, unknown>;
}

/** Health KPIs rendered in the summary panel above the table. */
export type SummaryPanelKpi = Record<
  'datasetHealthPoor' | 'datasetHealthDegraded' | 'datasetHealthGood' | 'activeDatasets',
  string
>;

/**
 * The Data Set Quality list page (`management/data/data_quality`).
 *
 * Methods return state (text, counts, locators); assertions belong in the specs.
 */
export class DatasetQualityPage {
  readonly table;
  readonly filtersContainer;
  readonly searchInput;
  readonly noDataEmptyState;
  readonly noPrivilegesEmptyState;
  readonly showFullDatasetNamesSwitch;
  readonly showInactiveDatasetsSwitch;
  readonly refreshButton;

  constructor(private readonly page: ScoutPage) {
    this.table = page.testSubj.locator('datasetQualityTable');
    this.filtersContainer = page.testSubj.locator('datasetQualityFiltersContainer');
    this.searchInput = page.testSubj.locator('datasetQualityFilterBarFieldSearch');
    this.noDataEmptyState = page.testSubj.locator('datasetQualityTableNoData');
    this.noPrivilegesEmptyState = page.testSubj.locator('datasetQualityNoPrivilegesEmptyState');
    // These switches expose no dedicated test subject, so they are matched by the
    // accessible name EUI renders from their aria-label.
    this.showFullDatasetNamesSwitch = page.getByRole('switch', {
      name: 'Show full data set names',
    });
    this.showInactiveDatasetsSwitch = page.getByRole('switch', {
      name: 'Show inactive data sets',
    });
    this.refreshButton = page.testSubj.locator('querySubmitButton');
  }

  private buildUrlParams(pageState: ListPageState = {}) {
    const state = { v: 1, table: { page: 0 }, filters: {}, ...pageState };
    return { [DATA_QUALITY_URL_STATE_KEY]: rison.encode(state) };
  }

  async goto(pageState: ListPageState = {}): Promise<void> {
    await this.page.gotoApp(DATA_QUALITY_APP_PATH, { params: this.buildUrlParams(pageState) });
    await this.waitUntilTableLoaded();
  }

  /**
   * Waits for the table to finish its initial load. EUI keeps the loading class on
   * the wrapper while a request is in flight and no test subject reflects that.
   */
  async waitUntilTableLoaded(): Promise<void> {
    await this.table.waitFor({ state: 'visible' });
    await this.page.locator('.euiBasicTable-loading').waitFor({ state: 'detached' });
  }

  async waitUntilSummaryPanelLoaded(): Promise<void> {
    for (const kpi of ['Active Data Sets', 'Estimated Data']) {
      await this.page.testSubj
        .locator(`datasetQuality-${kpi}-loading`)
        .waitFor({ state: 'detached' });
    }
  }

  async refresh(): Promise<void> {
    await this.filtersContainer.waitFor({ state: 'visible' });
    await this.refreshButton.click();
    await this.waitUntilTableLoaded();
  }

  /**
   * Reads the summary panel KPIs.
   *
   * `estimatedData` and any size-derived KPI are unavailable on serverless
   * (the `_stats` API is not exposed there — elastic/kibana#178954), so callers
   * on that deployment must exclude them.
   */
  async getSummaryPanelKpis(): Promise<SummaryPanelKpi> {
    await this.waitUntilSummaryPanelLoaded();

    const read = async (title: string) =>
      (
        await this.page.testSubj.locator(`datasetQualityDatasetHealthKpi-${title}`).innerText()
      ).trim();

    return {
      datasetHealthPoor: await read('Poor'),
      datasetHealthDegraded: await read('Degraded'),
      datasetHealthGood: await read('Good'),
      activeDatasets: await read('Active Data Sets'),
    };
  }

  async getEstimatedDataKpi(): Promise<string> {
    await this.waitUntilSummaryPanelLoaded();
    return (
      await this.page.testSubj.locator('datasetQualityDatasetHealthKpi-Estimated Data').innerText()
    ).trim();
  }

  async getTableHeaderTexts(): Promise<string[]> {
    await this.waitUntilTableLoaded();
    return (await this.table.locator('thead th, thead td').allInnerTexts()).map(
      normalizeHeaderText
    );
  }

  getRows() {
    return this.table.locator('tbody tr');
  }

  async getRowCount(): Promise<number> {
    await this.waitUntilTableLoaded();
    return this.getRows().count();
  }

  /**
   * Reads the table as a list of column-name keyed records, so assertions can
   * name the column they care about instead of tracking cell indexes.
   */
  async parseTable(): Promise<Array<Record<string, string>>> {
    await this.waitUntilTableLoaded();
    const headers = await this.getTableHeaderTexts();
    const rows = await this.getRows().all();

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

  async getColumnValues(column: string): Promise<string[]> {
    const rows = await this.parseTable();
    return rows.map((row) => row[column] ?? '');
  }

  async getDatasetNames(): Promise<string[]> {
    return this.getColumnValues(TABLE_COLUMNS.name);
  }

  /**
   * Sorts a column, clicking at most twice.
   *
   * An EUI sort header cycles none -> ascending -> descending, so from any starting
   * state the requested direction is at most two clicks away. The state is read
   * between clicks rather than looped over, so a header that stops responding fails
   * instead of silently retrying.
   */
  async sortBy(column: string, direction: 'ascending' | 'descending'): Promise<void> {
    const header = this.table.locator('thead th', { hasText: column });

    for (let click = 0; click < 2; click++) {
      if ((await header.getAttribute('aria-sort')) === direction) {
        return;
      }
      await header.getByRole('button').click();
      await this.waitUntilTableLoaded();
    }

    if ((await header.getAttribute('aria-sort')) !== direction) {
      throw new Error(`Could not sort column "${column}" ${direction}`);
    }
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.waitUntilTableLoaded();
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.waitUntilTableLoaded();
  }

  async toggleShowFullDatasetNames(): Promise<void> {
    await this.showFullDatasetNamesSwitch.click();
    await this.waitUntilTableLoaded();
  }

  async toggleShowInactiveDatasets(): Promise<void> {
    await this.showInactiveDatasetsSwitch.click();
    await this.waitUntilTableLoaded();
  }

  private async filterFor(
    buttonTestSubj: string,
    containerTestSubj: string,
    values: string[]
  ): Promise<void> {
    await this.page.testSubj.click(buttonTestSubj);
    for (const value of values) {
      await selectOptionByText(this.page, containerTestSubj, value);
    }
    await this.waitUntilTableLoaded();
  }

  async filterForIntegrations(integrations: string[]): Promise<void> {
    await this.filterFor(
      'datasetQualityIntegrationsSelectableButton',
      'datasetQualityIntegrationsSelectable',
      integrations
    );
  }

  async filterForNamespaces(namespaces: string[]): Promise<void> {
    await this.filterFor(
      'datasetQualityNamespacesSelectableButton',
      'datasetQualityNamespacesSelectable',
      namespaces
    );
  }

  async filterForQualities(qualities: string[]): Promise<void> {
    await this.filterFor(
      'datasetQualityQualitiesSelectableButton',
      'datasetQualityQualitiesSelectable',
      qualities
    );
  }

  getTypesFilter() {
    return this.page.testSubj.locator('datasetQualityFilterTypeSelectableButton');
  }

  /** Locates the "insufficient privileges" badge rendered in place of a cell value. */
  getInsufficientPrivilegesBadge(dataset: string) {
    return this.page.testSubj.locator(`datasetQualityInsufficientPrivileges-${dataset}`);
  }

  getExpandButton(dataset: string) {
    return this.getRowByDataset(dataset).locator('[data-test-subj="datasetQualityExpandButton"]');
  }

  /**
   * Matches the dataset name exactly so lookups can't straddle two rows
   * (a substring match on `synth.1` would also hit `synth.10`).
   */
  getRowByDataset(dataset: string) {
    return this.getRows().filter({ has: this.page.getByText(dataset, { exact: true }) });
  }

  /** Opens the details page for a dataset via its row expand button. */
  async openDetails(dataset: string): Promise<void> {
    await this.getExpandButton(dataset).click();
  }

  /**
   * The "N/A" / "Set failure store" link rendered in the failed-docs column.
   *
   * Takes the full data stream name, not the data set: the component suffixes the
   * test subject with the stream's raw name (e.g. `logs-synth.1-default`).
   */
  getSetFailureStoreLink(dataStream: string) {
    return this.page.testSubj.locator(`datasetQualitySetFailureStoreLink-${dataStream}`);
  }

  /** The link that opens a data set's details page, suffixed with the stream name. */
  getDetailsLink(dataStream: string) {
    return this.page.testSubj.locator(`datasetQualityTableDetailsLink-${dataStream}`);
  }

  /**
   * The "Open" action that sends a data set to Discover. Scoped to the row, because
   * each row also renders a details link that would otherwise match too.
   */
  getOpenInDiscoverLink(dataset: string) {
    return this.getRowByDataset(dataset).locator(
      '[data-test-subj="datasetQualityLogsExplorerLinkLink"]'
    );
  }
}
