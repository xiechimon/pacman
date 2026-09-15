/**
 * Centralized path configuration for Pacman.
 *
 * Supports multi-instance development via PACMAN_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., craft-tui-agent-1), the detect-instance.sh
 * script sets PACMAN_CONFIG_DIR to ~/.pacman-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.pacman/
 * Instance 1 (-1 suffix): ~/.pacman-1/
 * Instance 2 (-2 suffix): ~/.pacman-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.pacman/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.PACMAN_CONFIG_DIR || join(homedir(), '.pacman');
