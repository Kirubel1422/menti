import type Ably from 'ably';
import { AxiosError } from 'axios';

type GetToken = () => Promise<Ably.TokenRequest | Ably.TokenDetails>;

type Callback = (
  error: Ably.ErrorInfo | string | null,
  tokenRequestOrDetails: Ably.TokenDetails | Ably.TokenRequest | string | null,
) => void;

export const getAuthCallback =
  (getToken: GetToken) =>
  async (_tokenParams: Ably.TokenParams, callback: Callback) => {
    try {
      const token = await getToken();
      callback(null, token);
    } catch (error) {
      if (!(error instanceof AxiosError)) throw error;

      if (error.response?.status === 403) {
        callback(
          {
            name: error.name,
            code: 40170, // 40170 - error from client token callback
            message: error.message,
            // setting this instructs Ably to stop retrying to connect:
            statusCode: 403,
            cause: error,
          },
          null,
        );
      }
    }
  };
