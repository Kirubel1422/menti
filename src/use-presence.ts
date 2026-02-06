import React from 'react';
import type Ably from 'ably';
import type { SeriesPrivateChannel } from './channel-enums';
import { usePresentationRealtimeStore } from './stores/presentation-realtime';
import { channelGenerator } from './channel-generator';
import { catchRecoverableAblyError, shouldNoOp } from './utils';

interface DataInterface<D> extends Ably.PresenceMessage {
  data: D;
}

type Operation = Parameters<typeof shouldNoOp>[0]['operation'];

export function usePresenceActions<D>(channel: SeriesPrivateChannel) {
  const client = usePresentationRealtimeStore((state) => state.client);
  const channelName = channelGenerator(channel);
  const actions = React.useMemo(() => {
    if (!channelName) {
      throw new Error('invalid channel');
    }

    const runOperation = async <T = Promise<void>>(
      operation: Operation,
      fn: (realtimeChannel: Ably.RealtimeChannel) => T,
    ) => {
      if (!client) {
        throw new Error('client not found');
      }

      let realtimeChannel: Ably.RealtimeChannel | undefined;
      try {
        realtimeChannel = client.channels.get(channelName);

        if (
          shouldNoOp({
            channelState: realtimeChannel.state,
            connectionState: client.connection.state,
            errorReason: client.connection.errorReason,
            operation,
          })
        ) {
          return Promise.resolve();
        }

        const res = await fn(realtimeChannel);
        return res;
      } catch (e) {
        if (e instanceof Error) {
          catchRecoverableAblyError(e, {
            operation,
            channelState: realtimeChannel?.state,
            connectionState: client.connection.state,
          });
        }
      }
    };

    return {
      get() {
        return runOperation<Promise<DataInterface<D>[] | void>>(
          'presence.get',
          (realtimeChannel) => realtimeChannel.presence.get(),
        );
      },

      update(data: D) {
        return runOperation('presence.update', (realtimeChannel) =>
          realtimeChannel.presence.update(data),
        );
      },

      enter(data: D) {
        return runOperation('presence.enter', (realtimeChannel) =>
          realtimeChannel.presence.enter(data),
        );
      },

      leave(data: D) {
        return runOperation('presence.leave', (realtimeChannel) =>
          realtimeChannel.presence.leave(data),
        );
      },
      subscribe(
        action: Ably.PresenceAction,
        listener?: Ably.messageCallback<Ably.PresenceMessage>,
      ) {
        return runOperation('presence.subscribe', (realtimeChannel) =>
          realtimeChannel.presence.subscribe(action, listener),
        );
      },
      unsubscribe() {
        return runOperation<void>('presence.unsubscribe', (realtimeChannel) =>
          realtimeChannel.presence.unsubscribe(),
        );
      },
    };
  }, [channelName, client]);

  return actions;
}
