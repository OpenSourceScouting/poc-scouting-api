import type { FeatureModule } from '../../platform/module';
import { yptRoutes } from './routes';

export const yptModule: FeatureModule = {
  tag: { name: 'YPT', description: 'The Youth Protection Training (YPT) status of one adult.' },
  basePath: '/v1',
  routes: yptRoutes,
};
