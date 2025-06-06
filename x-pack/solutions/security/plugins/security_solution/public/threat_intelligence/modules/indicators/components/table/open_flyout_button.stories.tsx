/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { StoryFn } from '@storybook/react';
import { createKibanaReactContext } from '@kbn/kibana-react-plugin/public';
import { mockUiSettingsService } from '../../../../mocks/mock_kibana_ui_settings_service';
import type { Indicator } from '../../../../../../common/threat_intelligence/types/indicator';
import { generateMockIndicator } from '../../../../../../common/threat_intelligence/types/indicator';
import { OpenIndicatorFlyoutButton } from './open_flyout_button';

export default {
  component: OpenIndicatorFlyoutButton,
  title: 'OpenIndicatorFlyoutButton',
  argTypes: {
    onOpen: { action: 'onOpen' },
    isOpen: {
      options: [true, false],
      control: {
        type: 'radio',
      },
    },
  },
};

const mockIndicator: Indicator = generateMockIndicator();

const KibanaReactContext = createKibanaReactContext({ uiSettings: mockUiSettingsService() });

const Template: StoryFn<typeof OpenIndicatorFlyoutButton> = (args) => {
  return (
    <KibanaReactContext.Provider>
      <OpenIndicatorFlyoutButton {...args} />
    </KibanaReactContext.Provider>
  );
};

export const Default = {
  render: Template,

  args: {
    indicator: mockIndicator,
    isOpen: false,
  },
};
