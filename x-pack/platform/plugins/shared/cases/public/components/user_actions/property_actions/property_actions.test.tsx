/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { waitForEuiPopoverOpen, screen } from '@elastic/eui/lib/test/rtl';
import userEvent from '@testing-library/user-event';

import { renderWithTestingProviders } from '../../../common/mock';
import { UserActionPropertyActions } from './property_actions';
import { AttachmentActionType } from '../../../client/attachment_framework/types';

describe('UserActionPropertyActions', () => {
  const onClick = jest.fn();

  const props = {
    isLoading: false,
    propertyActions: [
      {
        type: AttachmentActionType.BUTTON as const,
        iconType: 'pencil',
        label: 'Edit',
        onClick,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the loading spinner correctly when loading', async () => {
    renderWithTestingProviders(<UserActionPropertyActions {...props} isLoading={true} />);

    expect(await screen.findByTestId('user-action-title-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('property-actions-user-action')).not.toBeInTheDocument();
  });

  it('renders the property actions', async () => {
    renderWithTestingProviders(<UserActionPropertyActions {...props} />);

    expect(await screen.findByTestId('property-actions-user-action')).toBeInTheDocument();

    await userEvent.click(await screen.findByTestId('property-actions-user-action-ellipses'));
    await waitForEuiPopoverOpen();

    expect((await screen.findAllByTestId('property-actions-user-action-group')).length).toBe(1);
    expect(await screen.findByTestId('property-actions-user-action-pencil')).toBeInTheDocument();
  });

  it('does not render if properties are empty', async () => {
    renderWithTestingProviders(
      <UserActionPropertyActions isLoading={false} propertyActions={[]} />
    );

    expect(screen.queryByTestId('property-actions-user-action')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-action-title-loading')).not.toBeInTheDocument();
  });
});
