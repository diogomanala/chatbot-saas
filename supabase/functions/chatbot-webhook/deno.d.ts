/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

// Deno global namespace
declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  }

  export const env: Env;

  export interface ConnInfo {
    readonly remoteAddr: {
      readonly hostname: string;
      readonly port: number;
      readonly transport: "tcp" | "udp";
    };
  }

  export interface ServeInit {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    onError?: (error: Error) => Response | Promise<Response>;
    onListen?: (params: { hostname: string; port: number }) => void;
  }

  export function serve(
    handler: (request: Request, connInfo: ConnInfo) => Response | Promise<Response>,
    options?: ServeInit
  ): Promise<void>;

  export function serve(
    options: ServeInit & {
      handler: (request: Request, connInfo: ConnInfo) => Response | Promise<Response>;
    }
  ): Promise<void>;
}

// Global Deno object
declare const Deno: typeof Deno;