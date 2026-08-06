import { build, files, version } from '$service-worker';
import { registerServiceWorker } from './lib/service-worker-runtime.js';

// Keep the SvelteKit-generated asset manifest in this entrypoint; the runtime
// implementation lives in a regular module so its cache policies can be tested.
registerServiceWorker(self, { build, files, version });
