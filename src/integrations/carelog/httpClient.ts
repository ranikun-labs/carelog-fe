import {
  CarelogConfigurationError,
  CarelogHttpError,
  CarelogNetworkError,
  CarelogProtocolError,
} from '@/integrations/carelog/errors';

export interface CarelogSessionProvider {
  credentials?: RequestCredentials;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
}

export interface CarelogHttpClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  sessionProvider?: CarelogSessionProvider;
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
}: CarelogHttpClientOptions): CarelogHttpClient {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!fetchImpl) throw new CarelogConfigurationError('The browser fetch API is unavailable.');

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const accessToken = await sessionProvider?.getAccessToken?.();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response: Response;
    try {
      response = await fetchImpl(joinUrl(normalizedBaseUrl, path), {
        method,
        headers,
        ...(sessionProvider?.credentials ? { credentials: sessionProvider.credentials } : {}),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new CarelogNetworkError('The Carelog API could not be reached.', { cause: error });
    }

    const text = await readResponseText(response);
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
