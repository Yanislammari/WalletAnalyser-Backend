export const requireEnv = (name: string): string => {
  const value: string | undefined = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
