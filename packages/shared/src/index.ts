/**
 * @pacman/shared
 *
 * Shared business logic for Pacman.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { Pacman } from '@pacman/shared/agent';
 *   import { loadStoredConfig } from '@pacman/shared/config';
 *   import { getCredentialManager } from '@pacman/shared/credentials';
 *   import { CraftMcpClient } from '@pacman/shared/mcp';
 *   import { debug } from '@pacman/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@pacman/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@pacman/shared/workspaces';
 *
 * Available modules:
 *   - agent: Pacman SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: Craft API client
 *   - config: Storage, models, preferences
 *   - credentials: Encrypted credential storage
 *   - mcp: MCP client, connection validation
 *   - prompts: System prompt generation
 *   - sources: Workspace-scoped source management (MCP, API, local)
 *   - utils: Debug logging, file handling, summarization
 *   - validation: URL validation
 *   - version: Version and installation management
 *   - workspaces: Workspace management (top-level organizational unit)
 */

// Export branding (standalone, no dependencies)
export * from './branding.ts';
