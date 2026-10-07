import { LOG_PREFIX } from "./constants";

export interface Logger {
  debug(message: string, ...data: unknown[]): void;
  error(message: string, ...data: unknown[]): void;
}

/** Debug output only when the "Debug logging" setting is on; errors always. */
export function createLogger(isDebug: () => boolean): Logger {
  return {
    debug(message, ...data) {
      if (isDebug()) console.debug(`${LOG_PREFIX} ${message}`, ...data);
    },
    error(message, ...data) {
      console.error(`${LOG_PREFIX} ${message}`, ...data);
    },
  };
}
