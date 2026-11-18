import {
  CarelogConfigurationError,
  CarelogHttpError,
  CarelogNetworkError,
  CarelogProtocolError,
} from './errors';

export interface CarelogSessionProvider {
  credentials?: 'omit' | 'same-origin' | 'include';
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  getSessionVersion?: () => number;
  recoverAccessToken?: () => Promise<string | undefined>;
  invalidateSessionIfVersion?: (expectedVersion: number) => boolean;
}

export interface CarelogHttpClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  sessionProvider?: CarelogSessionProvider;
  onUnauthorized?: () => void;
  onTerminalUnauthorized?: () => void;
}

interface CarelogEnvelope<T> {
  status: number;
  message: string;
  data: T;
}

export interface CarelogHttpClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
}

export function createCarelogHttpClient({
  baseUrl,
  fetchImpl = globalThis.fetch,
  sessionProvider,
  onUnauthorized,
  onTerminalUnauthorized,
}: CarelogHttpClientOptions): CarelogHttpClient {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!fetchImpl) throw new CarelogConfigurationError('The browser fetch API is unavailable.');

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const sessionVersion = sessionProvider?.getSessionVersion?.();
    const sessionIsCurrent = () =>
      sessionVersion === undefined || sessionProvider?.getSessionVersion?.() === sessionVersion;
    const assertCurrentSession = () => {
      if (!sessionIsCurrent()) {
        // A cancelled session's result must never reach caches or auth recovery.
        throw new DOMException('The Carelog request session changed.', 'AbortError');
      }
    };
    const accessToken = await sessionProvider?.getAccessToken?.();
    assertCurrentSession();
    const send = async (token: string | undefined): Promise<Response> => {
      assertCurrentSession();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        return await fetchImpl(joinUrl(normalizedBaseUrl, path), {
          method,
          redirect: 'error',
          headers,
          ...(sessionProvider?.credentials ? { credentials: sessionProvider.credentials } : {}),
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (error) {
        assertCurrentSession();
        throw new CarelogNetworkError('The Carelog API could not be reached.', { cause: error });
      }
    };

    let response = await send(accessToken);
    assertCurrentSession();

    if (
      response.status === 401 &&
      accessToken &&
      sessionProvider?.recoverAccessToken &&
      sessionIsCurrent()
    ) {
      onUnauthorized?.();
      let recoveredAccessToken: string | undefined;
      try {
        recoveredAccessToken = await sessionProvider.recoverAccessToken();
      } catch (error) {
        // Do not let an A refresh failure leak into B after an account switch.
        assertCurrentSession();
        throw error;
      }
      if (recoveredAccessToken && sessionIsCurrent()) {
        response = await send(recoveredAccessToken);
      }
    }

    assertCurrentSession();
    if (response.status === 401) {
      const invalidated =
        sessionVersion === undefined
          ? true
          : (sessionProvider?.invalidateSessionIfVersion?.(sessionVersion) ?? false);
      if (invalidated) onTerminalUnauthorized?.();
    }
    assertCurrentSession();
    let text: string;
    try {
      text = await readResponseText(response);
    } catch (error) {
      assertCurrentSession();
      throw error;
    }
    assertCurrentSession();
    if (response.status === 204) return undefined as T;
    const payload = parseJson(text, response.ok);

    if (!response.ok) throw new CarelogHttpError(response.status, payload);

    const envelope = validateEnvelope<T>(payload);
    if (envelope.status !== response.status) {
      throw new CarelogProtocolError(
        'The Carelog API envelope status does not match HTTP status.',
        {
          responseStatus: response.status,
          envelope,
        },
      );
    }
    return envelope.data;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  };
}

function normalizeBaseUrl(value: string): string {
  if (!value.trim()) throw new CarelogConfigurationError('The Carelog API base URL is required.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CarelogConfigurationError('The Carelog API base URL is invalid.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CarelogConfigurationError('The Carelog API base URL must use HTTP or HTTPS.');
  }
  return url.toString().replace(/\/$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.replace(/^\//, '')}`;
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    throw new CarelogNetworkError('The Carelog API response could not be read.', { cause: error });
  }
}

function parseJson(text: string, isSuccess: boolean): unknown {
  if (!text.trim()) {
    if (isSuccess) throw new CarelogProtocolError('The Carelog API returned an empty response.');
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!isSuccess) return text;
    throw new CarelogProtocolError('The Carelog API returned invalid JSON.', text);
  }
}

function validateEnvelope<T>(payload: unknown): CarelogEnvelope<T> {
  if (!payload || typeof payload !== 'object') {
    throw new CarelogProtocolError('The Carelog API response envelope is invalid.', payload);
  }
  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.status !== 'number' ||
    !Number.isInteger(candidate.status) ||
    typeof candidate.message !== 'string' ||
    !Object.prototype.hasOwnProperty.call(candidate, 'data')
  ) {
    throw new CarelogProtocolError('The Carelog API response envelope is invalid.', payload);
  }
  return candidate as unknown as CarelogEnvelope<T>;
}
