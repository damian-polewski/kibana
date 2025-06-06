/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { screen } from '@testing-library/react';

import { connector } from '../mock';
import FieldsPreview from './case_fields_preview';

import { renderWithTestingProviders } from '../../../common/mock';

describe('Webhook fields: Preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render any fields', () => {
    renderWithTestingProviders(<FieldsPreview connector={connector} fields={null} />);
    expect(screen.queryByTestId('card-list-item')).not.toBeInTheDocument();
  });

  it('shows the warning comment callout', () => {
    renderWithTestingProviders(<FieldsPreview connector={connector} fields={null} />);
    expect(screen.getByTestId('create-comment-warning')).toBeInTheDocument();
  });

  it('does not shows the warning comment callout when connector is configured properly', () => {
    const configuredConnector = {
      ...connector,
      config: { createCommentUrl: 'https://example.com', createCommentJson: {} },
    };

    renderWithTestingProviders(<FieldsPreview connector={configuredConnector} fields={null} />);
    expect(screen.queryByTestId('create-comment-warning')).not.toBeInTheDocument();
  });
});
