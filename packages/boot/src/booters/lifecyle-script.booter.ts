// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Constructor, inject} from '@loopback/context';
import {
  Application,
  asLifeCycleObserverBinding,
  CoreBindings,
  isLifeCycleObserverClass,
  LifeCycleObserver,
} from '@loopback/core';
import {ArtifactOptions} from '../interfaces';
import {BootBindings} from '../keys';
import {BaseArtifactBooter} from './base-artifact.booter';

type LifeCycleObserverClass = Constructor<LifeCycleObserver>;

/**
 * A class that extends BaseArtifactBooter to boot the 'LifeCycleScript' artifact type.
 *
 * Supported phases: configure, discover, load
 *
 * @param app Application instance
 * @param projectRoot Root of User Project relative to which all paths are resolved
 * @param [bootConfig] LifeCycleScript Artifact Options Object
 */
export class LifeCycleScriptBooter extends BaseArtifactBooter {
  observers: LifeCycleObserverClass[];

  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE)
    public app: Application,
    @inject(BootBindings.PROJECT_ROOT) projectRoot: string,
    @inject(`${BootBindings.BOOT_OPTIONS}#scripts`)
    public scriptConfig: ArtifactOptions = {},
  ) {
    super(
      projectRoot,
      // Set LifeCycleScript Booter Options if passed in via bootConfig
      Object.assign({}, LifeCycleScriptDefaults, scriptConfig),
    );
  }

  /**
   * Uses super method to get a list of Artifact classes. Boot each file by
   * creating a DataSourceConstructor and binding it to the application class.
   */
  async load() {
    await super.load();

    this.observers = this.classes.filter(isLifeCycleObserverClass);
    for (const observer of this.observers) {
      this.app
        .bind(`lifeCycleObservers.${observer.name}`)
        .toClass(observer)
        .apply(asLifeCycleObserverBinding);
    }
  }
}

/**
 * Default ArtifactOptions for DataSourceBooter.
 */
export const LifeCycleScriptDefaults: ArtifactOptions = {
  dirs: ['scripts'],
  extensions: ['.script.js'],
  nested: true,
};
