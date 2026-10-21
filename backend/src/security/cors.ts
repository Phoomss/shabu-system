export function allowedOrigin(origin?: string): boolean {
  if (!origin) return true; // Non-browser clients still need credentials.
  const origins = (
    process.env.CORS_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001'
  )
    .split(',')
    .map((value) => value.trim());
  for (const value of origins) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value)
      throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins');
  }
  return origins.includes(origin);
}
export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => callback(null, allowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
