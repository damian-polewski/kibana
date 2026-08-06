/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createPlaywrightConfig } from '@kbn/scout';

export default createPlaywrightConfig({
  testDir: './tests',
  // Scout defaults to a single worker, which these specs currently rely on: several of
  // them seed the shared `synth.1/2/3` data sets and call `logsSynthtraceEsClient.clean()`,
  // which deletes every `logs-*-*` data stream cluster-wide. Raising the worker count
  // needs those specs moved onto per-spec data set prefixes first.
  workers: 1,
});
