import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/integration/*.test.ts'],fileParallelism:false,env:{DATABASE_URL:process.env.INTEGRATION_DATABASE_URL||'postgresql://margintools:local_dev_only@localhost:5433/margintools_verify'}}});
