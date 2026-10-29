import type { FeatureModule } from '../../platform/module';
import { membershipRoutes } from './routes';

export const membershipModule: FeatureModule = {
  tag: { name: 'Membership', description: 'The registration status of one adult.' },
  basePath: '/v1',
  routes: membershipRoutes,
};
