/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { DataViewsPlugin, DataViewsContract } from '.';

export type Setup = jest.Mocked<ReturnType<DataViewsPlugin['setup']>>;
export type Start = jest.Mocked<ReturnType<DataViewsPlugin['start']>>;

const createSetupContract = (): Setup => ({
  enableRollups: jest.fn(),
});

const createStartContract = (): Start => {
  return {
    find: jest.fn((search) => [{ id: search, title: search }]),
    createField: jest.fn(() => {}),
    createFieldList: jest.fn(() => []),
    ensureDefaultIndexPattern: jest.fn(),
    ensureDefaultDataView: jest.fn().mockReturnValue(Promise.resolve({})),
    make: () => ({
      fieldsFetcher: {
        fetchForWildcard: jest.fn(),
      },
    }),
    hasData: {
      hasESData: jest.fn().mockReturnValue(Promise.resolve(true)),
      hasUserDataView: jest.fn().mockReturnValue(Promise.resolve(true)),
      hasDataView: jest.fn().mockReturnValue(Promise.resolve(true)),
    },
    getDefaultDataView: jest.fn().mockReturnValue(Promise.resolve({})),
    getDefaultId: jest.fn().mockReturnValue(Promise.resolve('')),
    get: jest.fn().mockReturnValue(
      Promise.resolve({
        title: '',
        fields: [],
      })
    ),
    clearCache: jest.fn(),
    getCanSaveSync: jest.fn(),
    getIdsWithTitle: jest.fn().mockResolvedValue([]),
    getFieldsForIndexPattern: jest.fn(),
    create: jest.fn().mockReturnValue(
      Promise.resolve({
        title: '',
        fields: [],
      })
    ),
    toDataView: jest.fn().mockReturnValue(Promise.resolve({})),
    toDataViewLazy: jest.fn().mockReturnValue(Promise.resolve({})),
    clearInstanceCache: jest.fn(),
  } as unknown as jest.Mocked<DataViewsContract>;
};

export const dataViewPluginMocks = {
  createSetupContract,
  createStartContract,
};
