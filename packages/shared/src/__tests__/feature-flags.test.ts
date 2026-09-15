import { describe, it, expect, afterEach } from 'bun:test';
import { isDevRuntime, isPacmanCliEnabled, isEmbeddedServerEnabled } from '../feature-flags.ts';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  PACMAN_DEBUG: process.env.PACMAN_DEBUG,
  PACMAN_FEATURE_CLI: process.env.PACMAN_FEATURE_CLI,
  PACMAN_FEATURE_EMBEDDED_SERVER: process.env.PACMAN_FEATURE_EMBEDDED_SERVER,
};

afterEach(() => {
  if (ORIGINAL_ENV.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;

  if (ORIGINAL_ENV.PACMAN_DEBUG === undefined) delete process.env.PACMAN_DEBUG;
  else process.env.PACMAN_DEBUG = ORIGINAL_ENV.PACMAN_DEBUG;

  if (ORIGINAL_ENV.PACMAN_FEATURE_CLI === undefined) delete process.env.PACMAN_FEATURE_CLI;
  else process.env.PACMAN_FEATURE_CLI = ORIGINAL_ENV.PACMAN_FEATURE_CLI;

  if (ORIGINAL_ENV.PACMAN_FEATURE_EMBEDDED_SERVER === undefined) delete process.env.PACMAN_FEATURE_EMBEDDED_SERVER;
  else process.env.PACMAN_FEATURE_EMBEDDED_SERVER = ORIGINAL_ENV.PACMAN_FEATURE_EMBEDDED_SERVER;
});

describe('feature-flags runtime helpers', () => {
  it('isDevRuntime returns true for explicit dev NODE_ENV', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.PACMAN_DEBUG;

    expect(isDevRuntime()).toBe(true);
  });

  it('isDevRuntime returns true for PACMAN_DEBUG override', () => {
    process.env.NODE_ENV = 'production';
    process.env.PACMAN_DEBUG = '1';

    expect(isDevRuntime()).toBe(true);
  });

  it('isPacmanCliEnabled defaults to false when no override is set', () => {
    delete process.env.PACMAN_FEATURE_CLI;

    expect(isPacmanCliEnabled()).toBe(false);
  });

  it('isPacmanCliEnabled honors explicit override true', () => {
    process.env.PACMAN_FEATURE_CLI = '1';

    expect(isPacmanCliEnabled()).toBe(true);
  });

  it('isPacmanCliEnabled honors explicit override false', () => {
    process.env.PACMAN_FEATURE_CLI = '0';

    expect(isPacmanCliEnabled()).toBe(false);
  });

  it('isEmbeddedServerEnabled defaults to false when no override is set', () => {
    delete process.env.PACMAN_FEATURE_EMBEDDED_SERVER;

    expect(isEmbeddedServerEnabled()).toBe(false);
  });

  it('isEmbeddedServerEnabled honors explicit override true', () => {
    process.env.PACMAN_FEATURE_EMBEDDED_SERVER = '1';

    expect(isEmbeddedServerEnabled()).toBe(true);
  });

  it('isEmbeddedServerEnabled honors explicit override false', () => {
    process.env.PACMAN_FEATURE_EMBEDDED_SERVER = '0';

    expect(isEmbeddedServerEnabled()).toBe(false);
  });
});
