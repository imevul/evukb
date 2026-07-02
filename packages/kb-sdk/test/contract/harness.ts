import { expect } from 'vitest';

import { EvuKbApiError, EvuKbClient } from '../../src/index.js';

export const BASE_URL = 'http://evukb.test';
export const API_KEY = 'test-api-key';
export const WS = 'ws-1';
export const CORPUS = 'corpus-1';

export type RecordedRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: RequestInit['body'];
};

export type ContractHarness = {
  client: EvuKbClient;
  requests: RecordedRequest[];
  lastRequest: () => RecordedRequest;
};

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function apiErrorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: message, code }, status);
}

export function sseResponse(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

export function createHarness(
  respond: (request: RecordedRequest) => Response | Promise<Response> = () => jsonResponse({}),
  options: { apiKey?: string | false } = {},
): ContractHarness {
  const requests: RecordedRequest[] = [];
  const apiKey = options.apiKey === false ? undefined : (options.apiKey ?? API_KEY);
  const client = new EvuKbClient({
    baseUrl: BASE_URL,
    ...(apiKey === undefined ? {} : { apiKey }),
    fetchImpl: async (input, init) => {
      const recorded: RecordedRequest = {
        url: String(input),
        method: init?.method ?? 'GET',
        headers: new Headers(init?.headers),
        body: init?.body,
      };
      requests.push(recorded);
      return respond(recorded);
    },
  });
  return {
    client,
    requests,
    lastRequest: () => {
      const request = requests.at(-1);
      if (!request) {
        throw new Error('no request was recorded');
      }
      return request;
    },
  };
}

export function parseJsonBody(request: RecordedRequest): unknown {
  return JSON.parse(String(request.body));
}

/** Asserts the standard headers for JSON requests built by #requestJson. */
export function expectJsonRequestHeaders(request: RecordedRequest, hasBody: boolean): void {
  expect(request.headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
  expect(request.headers.get('accept')).toBe('application/json');
  if (hasBody) {
    expect(request.headers.get('content-type')).toBe('application/json');
  } else {
    expect(request.headers.get('content-type')).toBeNull();
  }
}

export async function expectApiError(
  promise: Promise<unknown>,
  expected: { status: number; code: string; message: string },
): Promise<void> {
  const thrown = await promise.then(
    () => {
      throw new Error('expected the request to reject with EvuKbApiError');
    },
    (error: unknown) => error,
  );
  expect(thrown).toBeInstanceOf(EvuKbApiError);
  const apiError = thrown as EvuKbApiError;
  expect(apiError.status).toBe(expected.status);
  expect(apiError.code).toBe(expected.code);
  expect(apiError.message).toBe(expected.message);
}

export async function drain<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

export type ApiErrorCase = [name: string, invoke: (client: EvuKbClient) => Promise<unknown>];

/** Identity helper that keeps `it.each` error tables strongly typed. */
export function apiErrorCases(cases: ApiErrorCase[]): ApiErrorCase[] {
  return cases;
}

/**
 * Runs one SDK call against a stub that always returns a JSON `{error, code}`
 * body and asserts the call rejects with a matching EvuKbApiError.
 */
export async function expectStandardApiError(
  invoke: (client: EvuKbClient) => Promise<unknown>,
): Promise<void> {
  const harness = createHarness(() =>
    apiErrorResponse(404, 'not_found', 'The requested resource was not found.'),
  );
  await expectApiError(invoke(harness.client), {
    status: 404,
    code: 'not_found',
    message: 'The requested resource was not found.',
  });
}
