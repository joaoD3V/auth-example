/* eslint-disable no-constant-condition */
import axios, { AxiosError } from 'axios';
import { GetServerSidePropsContext } from 'next';
import { parseCookies, setCookie } from 'nookies';
import { signOut } from '../contexts/AuthContext';
import { AuthTokenError } from './errors/AuthTokenError';

interface AxiosErrorResponse {
  code?: string;
}

let isRefreshing = false;
let failedRequestsQueue: {
  onSuccess: (token: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFailure: (err: AxiosError<unknown, any>) => void;
}[] = [];

export function setupAPIClient(
  ctx: GetServerSidePropsContext | undefined = undefined
) {
  let cookies = parseCookies(ctx);

  const api = axios.create({
    baseURL: 'http://localhost:3333',
  });

  api.defaults.headers.common[
    'Authorization'
  ] = `Bearer ${cookies['auth.token']}`;

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: AxiosError<AxiosErrorResponse>) => {
      if (error.response?.status === 401) {
        if (error.response.data.code === 'token.expired') {
          cookies = parseCookies(ctx);

          const { 'auth.refreshToken': refreshToken } = cookies;
          const originalConfig = error.config;

          if (!isRefreshing) {
            isRefreshing = true;

            api
              .post('/refresh', {
                refreshToken,
              })
              .then((response) => {
                const { token } = response.data;

                setCookie(ctx, 'auth.token', token, {
                  maxAge: 60 * 60 * 24 * 30, // 30 dias
                  path: '/',
                });

                setCookie(
                  ctx,
                  'auth.refreshToken',
                  response.data.refreshToken,
                  {
                    maxAge: 60 * 60 * 24 * 30, // 30 dias
                    path: '/',
                  }
                );

                api.defaults.headers.common[
                  'Authorization'
                ] = `Bearer ${token}`;

                failedRequestsQueue.forEach((request) =>
                  request.onSuccess(token)
                );
                failedRequestsQueue = [];
              })
              .catch((err) => {
                failedRequestsQueue.forEach((request) =>
                  request.onFailure(err)
                );
                failedRequestsQueue = [];

                if (process.browser) {
                  signOut();
                }
              })
              .finally(() => {
                isRefreshing = false;
              });
          }

          return new Promise((resolve, reject) => {
            failedRequestsQueue.push({
              onSuccess: (token: string) => {
                originalConfig.headers!['Authorization'] = `Bearer ${token}`;

                resolve(api(originalConfig));
              },
              onFailure: (err: AxiosError) => {
                reject(err);
              },
            });
          });
        } else {
          if (process.browser) {
            signOut();
          } else {
            return Promise.reject(new AuthTokenError());
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return api;
}
