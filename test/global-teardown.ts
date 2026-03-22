import { TestEnvironment } from './test-setup';

export default async () => {
  console.log('\n--- Tearing Down Global Test Environment ---');

  // Suppress Redis socket errors that occur during container destruction
  const errorHandler = (err: any) => {
    const msg = err?.message || '';
    if (
      msg.includes('Socket closed unexpectedly') ||
      msg.includes('ECONNRESET') ||
      err?.code === 'ERR_UNHANDLED_ERROR'
    ) {
      return;
    }
    console.error('Unhandled error during global teardown:', err);
  };
  process.on('uncaughtException', errorHandler);
  process.on('unhandledRejection', errorHandler);

  const globalObj = globalThis as unknown as {
    __TEST_ENVIRONMENT__?: TestEnvironment;
  };
  const testEnv = globalObj.__TEST_ENVIRONMENT__;
  if (testEnv) {
    // Add a small delay to allow all app.close() calls in workers to finish
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      await testEnv.stop();
      console.log('--- Global Test Environment Stopped ---\n');
    } catch (error) {
      // silence any direct teardown errors
    }
  }
};
