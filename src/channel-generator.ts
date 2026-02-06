import {
  Channels,
  type SeriesPrivateChannel,
  type PresentationStateChannel,
} from './channel-enums';

/**
 * Takes a channel enum and returns a channel
 * with the corresponding that was requested.
 *
 * Eg: `series_v3_{series_id}` => `series_v3_a3dac413m21`
 *
 * @param channel - Channel enum, eg: `series_v3_{voteId}`
 * @returns A generated channel
 */
export function channelGenerator(
  channel: SeriesPrivateChannel | PresentationStateChannel | null,
) {
  if (!channel) return null;
  switch (channel.channel) {
    case Channels.SERIES_PRIVATE:
      return channel.channel.replace('{series_id}', channel.value);
    case Channels.PRESENTATION_STATE:
      return channel.channel.replace('{vote_key}', channel.value);
    default:
      throw new Error(`Invalid channel: ${(channel as any).channel}`);
  }
}
