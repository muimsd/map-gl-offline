import {
  createManagerServices,
  type OfflineManagerServiceOverrides,
  type OfflineManagerServices,
} from './base';
import { createOfflineMapManagerModules, type OfflineMapManagerModules } from './modules';

// Class/interface declaration merging: this makes every method declared on
// the module interfaces (RegionManagement, CleanupManagement, ...) available
// on OfflineMapManager instances at the type level, without re-declaring each
// one as a `declare public` field. The actual implementations are attached at
// runtime by the constructor via `Object.assign(this, this.modules)`.
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging */
export interface OfflineMapManager extends OfflineMapManagerModules {}

export class OfflineMapManager {
  private readonly services: OfflineManagerServices;
  private readonly modules: OfflineMapManagerModules;

  constructor(overrides: OfflineManagerServiceOverrides = {}) {
    this.services = createManagerServices(overrides);
    this.modules = createOfflineMapManagerModules(this.services);
    Object.assign(this, this.modules);
  }

  getServices(): OfflineManagerServices {
    return this.services;
  }

  getModules(): OfflineMapManagerModules {
    return this.modules;
  }
}

export const createOfflineMapManager = (overrides: OfflineManagerServiceOverrides = {}) => {
  const services = createManagerServices(overrides);
  const modules = createOfflineMapManagerModules(services);
  return { services, modules };
};

export type { OfflineManagerServices, OfflineManagerServiceOverrides } from './base';
export type { OfflineMapManagerModules } from './modules';
export { createOfflineMapManagerModules } from './modules';
