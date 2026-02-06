import React from 'react';
import Ably from 'ably';
import { usePresentationRealtimeStore } from './stores/presentation-realtime';

export const usePresentationRealtimeSetup = ({
  ablyConfig,
  shouldInit = true,
  enableRealtimePublishDDMetricsEnvVar,
}: {
  ablyConfig: Ably.ClientOptions;
  shouldInit?: boolean;
  enableRealtimePublishDDMetricsEnvVar: 'true' | 'false' | undefined;
}) => {
  const setClient = usePresentationRealtimeStore((state) => state.setClient);
  const client = usePresentationRealtimeStore((state) => state.client);
  const setConnectionState = usePresentationRealtimeStore(
    (state) => state.setConnectionState,
  );
  const setEnableDDMetrics = usePresentationRealtimeStore(
    (state) => state.setEnableDDMetrics,
  );

  React.useEffect(() => {
    if (!shouldInit) return;

    const client = new Ably.Realtime(ablyConfig);

    setClient(client);

    const listener = (newState: Ably.ConnectionStateChange) => {
      setConnectionState(newState.current);
    };

    setEnableDDMetrics(enableRealtimePublishDDMetricsEnvVar === 'true');

    client.connection.on(listener);
    return () => client.connection.off(listener);
  }, [
    ablyConfig,
    shouldInit,
    setClient,
    setConnectionState,
    setEnableDDMetrics,
    enableRealtimePublishDDMetricsEnvVar,
  ]);

  return Boolean(client);
};
