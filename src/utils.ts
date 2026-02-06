import { sendMetric } from '@mentimeter/errors/sendMetric';
import { captureException } from '@mentimeter/errors/sentry';
import { MentiError } from '@mentimeter/error-utils/error';
import type Ably from 'ably';

const IGNORE_ABLY_ERROR_CODES = [80000, 80002, 80003, 80008, 80016];

type Operation =
  | 'subscribe'
  | 'publish'
  | 'presence.get'
  | 'presence.subscribe'
  | 'presence.unsubscribe'
  | 'presence.update'
  | 'presence.enter'
  | 'presence.leave';

export const shouldNoOp = ({
  channelState,
  connectionState,
  errorReason,
  operation,
}: {
  channelState: Ably.ChannelState;
  connectionState: Ably.ConnectionState;
  errorReason?: Ably.ErrorInfo;
  operation: Operation;
}) => {
  if (
    (channelState === 'suspended' && operation !== 'subscribe') ||
    channelState === 'failed'
  ) {
    return true;
  }

  if (
    connectionState === 'closing' ||
    connectionState === 'closed' ||
    connectionState === 'suspended'
  ) {
    return true;
  }
  if (
    connectionState === 'failed' &&
    errorReason?.code === 80019 &&
    errorReason?.statusCode === 403
  ) {
    return true;
  }
  return false;
};

export const isAblyError = (error: unknown): error is Ably.ErrorInfo =>
  typeof error === 'object' &&
  error !== null &&
  'message' in error &&
  'code' in error &&
  'statusCode' in error;

export const catchRecoverableAblyError = (
  e: Error,
  context: {
    channelState?: Ably.ChannelState | undefined;
    connectionState?: Ably.ConnectionState | undefined;
    operation: Operation;
  },
) => {
  if (isAblyError(e) && IGNORE_ABLY_ERROR_CODES.includes(e.code)) {
    return;
  }
  if (isAblyError(e) && e.code === 40102) {
    /* tried to subscribe while the clientside and server-side clientId passed to Ably were out of sync.
    this is likely caused by the session_token of the user having expired */
    return;
  }
  if (isAblyError(e) && e.statusCode === 403) {
    /* tried to subscribe to events from a series that doesnt exist or which the user doesnt have access to.
    we call usePresentationRealtimeSetup and certain subscriptions before the series is loaded,
    so there's no guarantee we'll be able to fetch a token and subscribe. When that happens we
    can swallow the error, since its expected that no messages will come through. */
    return;
  }

  if (isAblyError(e)) {
    if (e.code === 90001 || e.code === 90007) {
      sendMetric({
        name: 'mmjs.ably.ignored.error.codes',
        value: 1,
        tags: [`code:${e.code}`],
      });
    }
    return;
  }

  captureException(new MentiError(e.message, { feature: 'live' }));
};

export const isUrl = (string: string): boolean => {
  let url: URL;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
};
