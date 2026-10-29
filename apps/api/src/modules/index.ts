import type { FeatureModule } from '../platform/module';
import { membershipModule } from './membership';
import { positionsModule } from './positions';
import { sytModule } from './syt';

/** The module registry. Adding a feature = adding one entry here. */
export const modules: readonly FeatureModule[] = [sytModule, membershipModule, positionsModule];
