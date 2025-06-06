/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { EuiSpacer } from '@elastic/eui';
import { encode, safeDecode } from '@kbn/rison';
import { useDeepEqualSelector } from './use_selector';
import { TimelineId } from '../../../common/types/timeline';
import { timelineSelectors } from '../../timelines/store';
import type { TimelineUrl } from '../../timelines/store/model';
import { timelineDefaults } from '../../timelines/store/defaults';
import { useKibana } from '../lib/kibana';
import { URL_PARAM_KEY } from './use_url_state';

/**
 * Potentially why the markdown component needs a click handler as well for timeline?
 * see: x-pack/solutions/security/plugins/security_solution/public/common/components/markdown_editor/plugins/timeline/processor.tsx
 */
export const useResolveConflict = () => {
  const { search, pathname } = useLocation();
  const { spaces } = useKibana().services;
  const getTimeline = useMemo(() => timelineSelectors.getTimelineByIdSelector(), []);
  const { resolveTimelineConfig, savedObjectId, show, activeTab } = useDeepEqualSelector(
    (state) => getTimeline(state, TimelineId.active) ?? timelineDefaults
  );

  const getLegacyUrlConflictCallout = useCallback(() => {
    // This function returns a callout component *if* we have encountered a "legacy URL conflict" scenario

    const searchQuery = new URLSearchParams(search);
    const timelineRison = searchQuery.get(URL_PARAM_KEY.timeline) ?? undefined;
    // Try to get state on URL, but default to what's in Redux in case of decodeRisonFailure
    const currentTimelineState = {
      id: savedObjectId ?? '',
      isOpen: !!show,
      activeTab,
    };
    const timelineSearch =
      (safeDecode(timelineRison ?? '') as TimelineUrl | null) ?? currentTimelineState;

    // We have resolved to one object, but another object has a legacy URL alias associated with this ID/page. We should display a
    // callout with a warning for the user, and provide a way for them to navigate to the other object.
    const currentObjectId = timelineSearch?.id;
    if (
      !spaces ||
      resolveTimelineConfig?.outcome !== 'conflict' ||
      resolveTimelineConfig?.alias_target_id == null ||
      currentObjectId == null
    ) {
      return null;
    }
    const newSavedObjectId = resolveTimelineConfig?.alias_target_id ?? ''; // This is always defined if outcome === 'conflict'

    const newTimelineSearch: TimelineUrl = {
      ...timelineSearch,
      id: newSavedObjectId,
    };
    const newTimelineRison = encode(newTimelineSearch);
    searchQuery.set(URL_PARAM_KEY.timeline, newTimelineRison);

    const newPath = `${pathname}?${searchQuery.toString()}${window.location.hash}`;

    return (
      <>
        {spaces.ui.components.getLegacyUrlConflict({
          objectNoun: URL_PARAM_KEY.timeline,
          currentObjectId,
          otherObjectId: newSavedObjectId,
          otherObjectPath: newPath,
        })}
        <EuiSpacer />
      </>
    );
  }, [
    activeTab,
    pathname,
    resolveTimelineConfig?.alias_target_id,
    resolveTimelineConfig?.outcome,
    savedObjectId,
    search,
    show,
    spaces,
  ]);

  return useMemo(() => getLegacyUrlConflictCallout(), [getLegacyUrlConflictCallout]);
};
