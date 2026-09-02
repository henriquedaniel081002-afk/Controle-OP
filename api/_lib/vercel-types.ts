export interface VercelRequest {
  method?: string;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  setHeader(name: string, value: string | string[]): VercelResponse;
  status(statusCode: number): VercelResponse;
  json(body: unknown): VercelResponse;
}
