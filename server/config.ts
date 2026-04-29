export interface ServerConfig {
  backendUrl: string;
  port: number;
  host: string;
}

export function loadConfig(): ServerConfig {
  return {
    backendUrl: process.env.TURNTF_BACKEND_URL ?? "http://localhost:8080",
    port: parseInt(process.env.SERVER_PORT ?? "3100", 10),
    host: process.env.SERVER_HOST ?? "0.0.0.0",
  };
}
