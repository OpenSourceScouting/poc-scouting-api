import type { FeatureModule } from '../../platform/module';
import { positionsRoutes } from './routes';

export const positionsModule: FeatureModule = {
  tag: { name: 'Positions', description: 'The positions that one adult holds in one named organization.' },
  basePath: '/v1',
  routes: positionsRoutes,
};
