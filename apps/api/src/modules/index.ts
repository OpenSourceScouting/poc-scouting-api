import type { FeatureModule } from '../platform/module';
import { membershipModule } from './membership';
import { positionsModule } from './positions';
import { yptModule } from './ypt';

/** The module registry. Adding a feature = adding one entry here. */
export const modules: readonly FeatureModule[] = [yptModule, membershipModule, positionsModule];
