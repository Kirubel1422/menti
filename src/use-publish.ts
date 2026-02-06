import * as React from 'react';
import { sendMetric } from '@mentimeter/errors/sendMetric';
import {
  type SeriesPrivateChannel,
  type SeriesPrivateEvents,
  type PresentationStateEvents,
  type PresentationStateChannel,
  internalChannelToRealAblyChannel,
} from './channel-enums';
import { channelGenerator } from './channel-generator';
import { usePresentationRealtimeStore } from './stores/presentation-realtime';
import type {
  NavigationPayload,
  ResultPayload,
  QfaSyncPayload,
  UpdateNetworkCachePayload,
  PresentationStatePayload,
} from './types';
import { catchRecoverableAblyError, shouldNoOp } from './utils';

export function usePublish(channel: SeriesPrivateChannel | null): {
  (name: SeriesPrivateEvents.NAVIGATION, payload: NavigationPayload): void;
  (name: SeriesPrivateEvents.RESULT, payload: ResultPayload): Promise<void>;
  (name: SeriesPrivateEvents.QFA_SYNC, payload: QfaSyncPayload): Promise<void>;
  (
    name: SeriesPrivateEvents.UPDATE_NETWORK_CACHE,
    payload: UpdateNetworkCachePayload,
  ): Promise<void>;
};

export function usePublish(channel: PresentationStateChannel): {
  (
    name: PresentationStateEvents.PRESENTATION_STATE_SYNC_STATE,
    payload: PresentationStatePayload,
  ): Promise<void>;
};

export function usePublish<T>(channel: SeriesPrivateChannel): {
  (name: SeriesPrivateEvents, payload: T): Promise<void>;
};

export function usePublish(
  channel: SeriesPrivateChannel | PresentationStateChannel | null,
): (name: string, payload: any) => Promise<void> {
  const client = usePresentationRealtimeStore((state) => state.client);
  const enableDDMetrics = usePresentationRealtimeStore(
    (state) => state.enableDDMetrics,
  );
  const channelName = channel ? channelGenerator(channel) : null;

  return React.useMemo(() => {
    try {
      if (!client) {
        throw new Error('client not found');
      }
      if (!channelName) {
        throw new Error('Channel not found');
      }

      const realtimeChannel = client.channels.get(channelName);

      return (name, payload) => {
        if (
          shouldNoOp({
            channelState: realtimeChannel.state,
            connectionState: client.connection.state,
            errorReason: client.connection.errorReason,
            operation: 'publish',
          })
        ) {
          return Promise.resolve();
        }
        return realtimeChannel
          .publish(name, payload)
          .then(() => {
            if (!channel?.channel) return;
            if (!enableDDMetrics) return;

            sendMetric({
              name: 'ably.client.messages',
              tags: [
                `ably_message_type:publish`,
                `ably_channel:${internalChannelToRealAblyChannel(
                  channel?.channel,
                )}`,
                `ably_message_name:${name}`,
              ],
            });
          })
          .catch((e) =>
            catchRecoverableAblyError(e, {
              channelState: realtimeChannel.state,
              connectionState: client.connection.state,
              operation: 'publish',
            }),
          );
      };
    } catch (error) {
      return () => {
        throw error;
      };
    }
  }, [client, channelName, channel?.channel, enableDDMetrics]);
}
