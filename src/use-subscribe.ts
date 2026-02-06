import React from 'react';
import type Ably from 'ably';
import { captureException } from '@mentimeter/errors/sentry';
import { MentiError } from '@mentimeter/error-utils/error';
import type { QuizPlayerPostData } from '@mentimeter/quiz-types';
import type {
  NavigationPayload,
  QfaPayload,
  QfaSyncPayload,
  UpdateNetworkCachePayload,
  PresentationStatePayload,
  CommentPayload,
  ReactionPayload,
  ResultHasChangedPayload,
  ResultPayload,
  AudienceMemberCountUpdatedPayload,
  SlideDeckPaceSteps,
} from './types';
import type { Payload } from './utility-types';
import type {
  SeriesPrivateEvents,
  PresentationStateEvents,
  SeriesPrivateChannel,
  PresentationStateChannel,
} from './channel-enums';
import { usePresentationRealtimeStore } from './stores/presentation-realtime';
import { catchRecoverableAblyError, shouldNoOp } from './utils';
import { channelGenerator } from './channel-generator';

// --------------------------------------------
// FUNCTION OVERLOADS FOR BETTER MESSAGE TYPING
// --------------------------------------------

/**
 * A `COMMENT` event is triggered by a voter when a voter sends a comment.
 * This event is originates from the server.
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.COMMENT,
  callback: (msg: Payload<SeriesPrivateEvents.COMMENT, CommentPayload>) => void,
): void;

/**
 * A `REACTION` event is triggered by a voter when a voter sends a reaction.
 * This event is originates from the server.
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.REACTION,
  callback: (
    msg: Payload<SeriesPrivateEvents.REACTION, ReactionPayload>,
  ) => void,
): void;

/**
 * The `RESULT` event will notify when a question's result has changed
 * and include the result payload in the message
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.RESULT,
  callback: (msg: Payload<SeriesPrivateEvents.RESULT, ResultPayload>) => void,
): void;

/**
 * The `RESULT_HAS_CHANGED` event will notify when a question's result has changed
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.RESULT_HAS_CHANGED,
  callback: (
    msg: Payload<
      SeriesPrivateEvents.RESULT_HAS_CHANGED,
      ResultHasChangedPayload
    >,
  ) => void,
): void;

/**
 * The `NAVIGATION` event will trigger UI navigation events in Presview
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.NAVIGATION,
  callback: (
    msg: Payload<SeriesPrivateEvents.NAVIGATION, NavigationPayload>,
  ) => void,
): void;

/**
 * The `AUDIENCE_MEMBER_COUNT_UPDATED` event will return the number of connected audience members
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.AUDIENCE_MEMBER_COUNT_UPDATED,
  callback: (
    msg: Payload<
      SeriesPrivateEvents.AUDIENCE_MEMBER_COUNT_UPDATED,
      AudienceMemberCountUpdatedPayload
    >,
  ) => void,
): void;

/**
 * The `qfa_sync` event is used to sync QFA actions
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.QFA_SYNC,
  callback: (
    msg: Payload<SeriesPrivateEvents.QFA_SYNC, QfaSyncPayload>,
  ) => void,
): void;

/**
 * The `qfa` event is used to sync QFA data
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.QFA,
  callback: (msg: Payload<SeriesPrivateEvents.QFA, QfaPayload>) => void,
): void;

/**
 * The `UPDATE_NETWORK_CACHE` indicates to other clients that data in the network cache
 * should be refetched from the server
 */
export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.UPDATE_NETWORK_CACHE,
  callback: (
    msg: Payload<
      SeriesPrivateEvents.UPDATE_NETWORK_CACHE,
      UpdateNetworkCachePayload
    >,
  ) => void,
): void;

export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.PRESENTATION_STATE_UPDATE_SERIES,
  callback: (
    msg: Payload<
      SeriesPrivateEvents.PRESENTATION_STATE_UPDATE_SERIES,
      {
        payload: {
          slide_deck_steps: Array<{
            slide_public_key: string;
            steps: Array<SlideDeckPaceSteps>;
          }>;
        };
      }
    >,
  ) => void,
): void;

export function useSubscribe(
  channel: PresentationStateChannel,
  event: PresentationStateEvents.PRESENTATION_STATE_SYNC_STATE,
  callback: (
    msg: Payload<
      PresentationStateEvents.PRESENTATION_STATE_SYNC_STATE,
      PresentationStatePayload
    >,
  ) => void,
): void;

export function useSubscribe(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents.QUIZ_MARKED_ANSWER,
  callback: (
    msg: Payload<
      SeriesPrivateEvents.QUIZ_MARKED_ANSWER,
      { payload: QuizPlayerPostData }
    >,
  ) => void,
): void;

/**
 * Catch all events that gets sent on the channel
 */

export function useSubscribe<T>(
  channel: PresentationStateChannel,
  event: PresentationStateEvents,
  callback: (msg: Payload<PresentationStateEvents, T>) => void,
): void;

export function useSubscribe<T>(
  channel: PresentationStateChannel,
  callback: (msg: Payload<PresentationStateEvents, T>) => void,
): void;

export function useSubscribe<T>(
  channel: SeriesPrivateChannel,
  event: SeriesPrivateEvents,
  callback: (msg: Payload<SeriesPrivateEvents, T>) => void,
): void;

export function useSubscribe<T>(
  channel: SeriesPrivateChannel,
  callback?: (msg: Payload<SeriesPrivateEvents, T>) => void,
): void;

// -------------------------
// END OF FUNCTION OVERLOADS
// -------------------------

export function useSubscribe<T>(
  channel: SeriesPrivateChannel | PresentationStateChannel,
  eventOrCallback?: string | ((msg: Payload<any, T>) => void),
  callback?: (msg: Payload<any, T>) => void,
) {
  const channelName = channelGenerator(channel);
  const shouldSubscribe = channel?.shouldSubscribe ?? true;

  const client = usePresentationRealtimeStore((state) => state.client);
  const connectionState = usePresentationRealtimeStore(
    (state) => state.connectionState,
  );

  if (!client && channelName && shouldSubscribe) {
    throw new Error(
      'Trying to subscribe without client. Make sure to set up presentation realtime store with usePresentationRealtimeSetup.',
    );
  }
  const echoMessages = Boolean(channel?.options?.echoMessages);

  const connectionIdRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    connectionIdRef.current = client?.connection?.id;
  }, [client?.connection?.id]);

  const event =
    typeof eventOrCallback === 'string' ? eventOrCallback : undefined;
  const callbackMethod =
    typeof eventOrCallback === 'function' ? eventOrCallback : callback;

  // Make sure we don't subscribe on each callback change
  const callbackRef = React.useRef(
    typeof callbackMethod === 'function' ? callbackMethod : undefined,
  );
  React.useEffect(() => {
    callbackRef.current = callbackMethod;
  }, [callbackMethod]);

  const channelOptsRef = React.useRef(channel.ablyOptions);

  React.useEffect(() => {
    if (!channelName || !client || !shouldSubscribe) return;

    if (connectionState === 'closed') {
      return;
    }

    try {
      const realtimeChannel = client.channels.get(channelName);
      if (channelOptsRef.current) {
        realtimeChannel.setOptions(channelOptsRef.current);
      }
      if (
        shouldNoOp({
          channelState: realtimeChannel.state,
          connectionState: client.connection.state,
          operation: 'subscribe',
          errorReason: client.connection.errorReason,
        })
      ) {
        return;
      }
      const errorHandler = (e: Ably.ErrorInfo & Error) =>
        catchRecoverableAblyError(e, {
          channelState: realtimeChannel.state,
          connectionState,
          operation: 'subscribe',
        });

      const listener = (msg: Ably.Message) => {
        if (connectionIdRef.current === msg.connectionId && !echoMessages) {
          // this is our own message, we don't want to trigger the callback
          return;
        }
        // Without name or data we do nothing
        if (!msg.name || !msg.data) return;
        try {
          if (!callbackRef.current) {
            throw new Error('callback is not defined');
          }
          callbackRef.current(msg as Payload<any, T>);
        } catch (error) {
          captureException(
            new MentiError(
              error instanceof Error ? error.message : 'Unknown error',
              {
                feature: 'live',
              },
            ),
          );
          return;
        }
      };

      if (event) {
        realtimeChannel.subscribe(event, listener).catch(errorHandler);
        return () => {
          realtimeChannel.unsubscribe(event, listener);
        };
      }
      realtimeChannel.subscribe(listener).catch(errorHandler);
      return () => void realtimeChannel.unsubscribe(listener);
    } catch (_e) {
      return;
    }
  }, [
    echoMessages,
    channelName,
    client,
    connectionState,
    event,
    shouldSubscribe,
  ]);
}
