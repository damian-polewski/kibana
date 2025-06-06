/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// Latest model version for dashboard saved objects is v3
export {
  dashboardAttributesSchema as dashboardSavedObjectSchema,
  type DashboardAttributes as DashboardSavedObjectAttributes,
  type GridData,
  type SavedDashboardPanel,
  type SavedDashboardSection,
} from './v3';
