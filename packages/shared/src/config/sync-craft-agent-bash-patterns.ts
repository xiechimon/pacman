#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPacmanReadOnlyBashPatterns } from './cli-domains.ts'

interface AllowedBashEntry {
  pattern: string
  comment?: string
}

interface PermissionsConfig {
  version?: string
  allowedBashPatterns?: AllowedBashEntry[]
  [key: string]: unknown
}

function isPacmanPattern(entry: AllowedBashEntry): boolean {
  return typeof entry.pattern === 'string' && entry.pattern.startsWith('^pacman\\s')
}

function syncPacmanPatterns(config: PermissionsConfig): PermissionsConfig {
  const patterns = config.allowedBashPatterns ?? []
  const firstCraftIndex = patterns.findIndex(isPacmanPattern)

  const withoutCraft = patterns.filter(entry => !isPacmanPattern(entry))
  const generated = getPacmanReadOnlyBashPatterns()

  const insertAt = firstCraftIndex >= 0 ? firstCraftIndex : withoutCraft.length
  const nextAllowedBashPatterns = [
    ...withoutCraft.slice(0, insertAt),
    ...generated,
    ...withoutCraft.slice(insertAt),
  ]

  return {
    ...config,
    allowedBashPatterns: nextAllowedBashPatterns,
  }
}

function main() {
  const targetPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(process.cwd(), 'apps/electron/resources/permissions/default.json')

  const config = JSON.parse(readFileSync(targetPath, 'utf-8')) as PermissionsConfig
  const nextConfig = syncPacmanPatterns(config)

  writeFileSync(targetPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf-8')
  process.stdout.write(`Synced pacman bash patterns in ${targetPath}\n`)
}

if (import.meta.main) {
  main()
}
