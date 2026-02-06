import type Ably from 'ably';

export enum SeriesPrivateEvents {
  RESULT = 'result',
  RESULT_HAS_CHANGED = 'result_has_changed',
  UPDATE_NETWORK_CACHE = 'update_network_cache',
  NAVIGATION = 'navigation',
  QFA_SYNC = 'qfa:sync',
  QFA = 'qfa',
  QUIZ_MARKED_ANSWER = 'quiz_marked_answer',
  REACTION = 'reaction',
  COMMENT = 'comment',
  PRESENTATION_STATE_UPDATE_SERIES = 'presentation_state:update_series',
  AUDIENCE_MEMBER_COUNT_UPDATED = 'audience_member_count_updated',
}

export enum PresentationStateEvents {
  PRESENTATION_STATE_SYNC_STATE = 'presentation_state:sync_state',
}

export enum Channels {
  /** used for presenter<->collabotator communication */
  SERIES_PRIVATE = 'series_v3_{series_id}',
  /** used for presenter<->collabotator<->voter communication */
  PRESENTATION_STATE = 'series_public:{vote_key}',
}

export const internalChannelToRealAblyChannel = (channel: Channels) => {
  return channel.replace('{vote_key}', '').replace('{series_id}', '');
};

interface Channel<T extends string> {
  channel: T;
  value: string;
  options?: { echoMessages?: boolean };
  ablyOptions?: Ably.ChannelOptions;
  shouldSubscribe?: boolean;
}

export type SeriesPrivateChannel = Channel<Channels.SERIES_PRIVATE>;
export type PresentationStateChannel = Channel<Channels.PRESENTATION_STATE>;
