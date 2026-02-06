import type Ably from 'ably';
import { create } from 'zustand';

export interface PresentationRealtimeState {
  client: Ably.Realtime | undefined;
  connectionState: Ably.ConnectionState | undefined;
  enableDDMetrics: boolean;
  setClient: (client: Ably.Realtime) => void;
  setConnectionState: (connectionState: Ably.ConnectionState) => void;
  setEnableDDMetrics: (enableDDMetrics: boolean) => void;
}

export const usePresentationRealtimeStore = create<PresentationRealtimeState>(
  (set) => ({
    client: undefined,
    connectionState: undefined,
    enableDDMetrics: false,
    setClient: (client) =>
      set(() => ({
        client,
      })),
    setConnectionState: (connectionState) => set(() => ({ connectionState })),
    setEnableDDMetrics: (enableDDMetrics) =>
      set(() => ({
        enableDDMetrics,
      })),
  }),
);
