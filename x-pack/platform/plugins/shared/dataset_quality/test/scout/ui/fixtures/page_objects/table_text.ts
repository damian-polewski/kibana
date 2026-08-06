/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Locator, ScoutPage } from '@kbn/scout';

/**
 * EUI and the embedded charts mix screen-reader-only content into the visible text
 * of table cells: every cell ends with a keyboard tab-stop hint (`↦`, or `↵` on the
 * last column), asynchronously loaded cells are prefixed with a "Loaded" status
 * line, and cells containing a spark plot append a chart description. None of that
 * is part of the value under test.
 */
const SCREEN_READER_ONLY_LINES = new Set([
  '↦',
  '↵',
  'Loaded',
  'Loading',
  'Chart type:',
  'bar chart',
]);

const meaningfulLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !SCREEN_READER_ONLY_LINES.has(line));

/** A column header renders its label plus a sort/tab-stop hint on a second line. */
export const normalizeHeaderText = (text: string): string => meaningfulLines(text)[0] ?? '';

/**
 * Keeps every meaningful line of a cell, because some cells legitimately render
 * two (the data set name column shows the display name above the raw name when
 * "show full data set names" is toggled on).
 */
export const normalizeCellText = (text: string): string => meaningfulLines(text).join('\n');

/**
 * Selects an option inside an `EuiSelectable`.
 *
 * `EuiSelectableWrapper` from `@kbn/scout` matches options by exact accessible
 * name, which never matches here: EUI appends ". To check this option, press
 * Enter." to each option's label. This matches on the option's visible text instead.
 */
export const selectOptionByText = async (
  page: ScoutPage,
  containerTestSubj: string,
  optionText: string
): Promise<void> => {
  const option: Locator = page
    .locator(`[data-test-subj="${containerTestSubj}"] li[role="option"]`)
    .filter({ hasText: optionText });

  await option.click();
};

/**
 * Selects an option in one of the app's searchable `Selector` filters (the field and
 * issue-type filters on the details page).
 *
 * Those lists are long enough to be virtualised, so an option that is scrolled out of
 * view is not in the DOM at all — the search box has to narrow the list first. The
 * option is then clicked by the dedicated test subject the component renders for it
 * (`<selector>Option-<label>`), which avoids matching on text that carries EUI's
 * screen-reader suffix.
 */
export const selectSearchableOption = async (
  page: ScoutPage,
  selectorTestSubj: string,
  label: string
): Promise<void> => {
  const container = page.testSubj.locator(`${selectorTestSubj}Options`);
  await container.waitFor({ state: 'visible' });

  await container.getByRole('searchbox').fill(label);
  await page.testSubj.locator(`${selectorTestSubj}Option-${label}`).click();
};
