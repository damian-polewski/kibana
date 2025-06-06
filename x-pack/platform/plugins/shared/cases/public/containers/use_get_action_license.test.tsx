/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { waitFor, renderHook } from '@testing-library/react';
import * as api from './api';
import { useGetActionLicense } from './use_get_action_license';
import { useToasts } from '../common/lib/kibana';
import { TestProviders } from '../common/mock';

jest.mock('./api');
jest.mock('../common/lib/kibana');

describe('useGetActionLicense', () => {
  const abortCtrl = new AbortController();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls getActionLicense with correct arguments', async () => {
    const spyOnGetActionLicense = jest.spyOn(api, 'getActionLicense');
    renderHook(() => useGetActionLicense(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(spyOnGetActionLicense).toBeCalledWith(abortCtrl.signal));
  });

  it('unhappy path', async () => {
    const addError = jest.fn();

    (useToasts as jest.Mock).mockReturnValue({ addError });
    const spyOnGetActionLicense = jest.spyOn(api, 'getActionLicense');
    spyOnGetActionLicense.mockImplementation(() => {
      throw new Error('Something went wrong');
    });

    renderHook(() => useGetActionLicense(), {
      wrapper: TestProviders,
    });
    await waitFor(() => expect(addError).toHaveBeenCalled());
  });
});
