import type { FeatureModule } from '../../platform/module';
import { sytRoutes } from './routes';

export const sytModule: FeatureModule = {
  tag: {
    name: 'SYT',
    description:
      'The Safeguarding Youth Training (SYT) status of one adult. SYT replaced Youth Protection Training (YPT) in May 2025.',
  },
  basePath: '/v1',
  routes: sytRoutes,
};
