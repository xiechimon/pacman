import { defineConfig } from 'drizzle-kit';

// migration 纪律（01 §6）：drizzle-kit 生成、进 repo、CI 校验 drift。
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
});
