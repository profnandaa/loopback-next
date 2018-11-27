// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  Binding,
  BindingScope,
  BindingType,
  Constructor,
  Context,
} from '@loopback/context';
import {Component, mountComponent} from './component';
import {CoreBindings} from './keys';
import {
  asLifeCycleObserverBinding,
  isLifeCycleObserver,
  isLifeCycleObserverClass,
  LifeCycleObserver,
} from './lifecycle';
import {Server} from './server';
import debugModule = require('debug');
const debug = debugModule('loopback:core:application');

/**
 * Application is the container for various types of artifacts, such as
 * components, servers, controllers, repositories, datasources, connectors,
 * and models.
 */
export class Application extends Context implements LifeCycleObserver {
  constructor(public options: ApplicationConfig = {}) {
    super();

    // Bind to self to allow injection of application context in other modules.
    this.bind(CoreBindings.APPLICATION_INSTANCE).to(this);
    // Make options available to other modules as well.
    this.bind(CoreBindings.APPLICATION_CONFIG).to(options);
  }

  /**
   * Register a controller class with this application.
   *
   * @param controllerCtor {Function} The controller class
   * (constructor function).
   * @param {string=} name Optional controller name, default to the class name
   * @return {Binding} The newly created binding, you can use the reference to
   * further modify the binding, e.g. lock the value to prevent further
   * modifications.
   *
   * ```ts
   * class MyController {
   * }
   * app.controller(MyController).lock();
   * ```
   */
  controller(controllerCtor: ControllerClass, name?: string): Binding {
    name = name || controllerCtor.name;
    const key = `controllers.${name}`;
    debug('Adding controller %s', name);
    return this.bind(key)
      .toClass(controllerCtor)
      .tag(CoreBindings.CONTROLLER_TAG);
  }

  /**
   * Bind a Server constructor to the Application's master context.
   * Each server constructor added in this way must provide a unique prefix
   * to prevent binding overlap.
   *
   * ```ts
   * app.server(RestServer);
   * // This server constructor will be bound under "servers.RestServer".
   * app.server(RestServer, "v1API");
   * // This server instance will be bound under "servers.v1API".
   * ```
   *
   * @param {Constructor<Server>} server The server constructor.
   * @param {string=} name Optional override for key name.
   * @returns {Binding} Binding for the server class
   * @memberof Application
   */
  public server<T extends Server>(
    ctor: Constructor<T>,
    name?: string,
  ): Binding {
    const suffix = name || ctor.name;
    const key = `${CoreBindings.SERVERS}.${suffix}`;
    debug('Adding server %s', suffix);
    return this.bind(key)
      .toClass(ctor)
      .tag(CoreBindings.SERVER_TAG)
      .apply(asLifeCycleObserverBinding);
  }

  /**
   * Bind an array of Server constructors to the Application's master
   * context.
   * Each server added in this way will automatically be named based on the
   * class constructor name with the "servers." prefix.
   *
   * If you wish to control the binding keys for particular server instances,
   * use the app.server function instead.
   * ```ts
   * app.servers([
   *  RestServer,
   *  GRPCServer,
   * ]);
   * // Creates a binding for "servers.RestServer" and a binding for
   * // "servers.GRPCServer";
   * ```
   *
   * @param {Constructor<Server>[]} ctors An array of Server constructors.
   * @returns {Binding[]} An array of bindings for the registered server classes
   * @memberof Application
   */
  public servers<T extends Server>(ctors: Constructor<T>[]): Binding[] {
    return ctors.map(ctor => this.server(ctor));
  }

  /**
   * Retrieve the singleton instance for a bound constructor.
   *
   * @template T
   * @param {Constructor<T>=} ctor The constructor that was used to make the
   * binding.
   * @returns {Promise<T>}
   * @memberof Application
   */
  public async getServer<T extends Server>(
    target: Constructor<T> | string,
  ): Promise<T> {
    let key: string;
    // instanceof check not reliable for string.
    if (typeof target === 'string') {
      key = `${CoreBindings.SERVERS}.${target}`;
    } else {
      const ctor = target as Constructor<T>;
      key = `${CoreBindings.SERVERS}.${ctor.name}`;
    }
    return await this.get<T>(key);
  }

  /**
   * Start the application, and all of its registered servers.
   *
   * @returns {Promise}
   * @memberof Application
   */
  public async start(): Promise<void> {
    debug('Starting the application...');
    const bindings = this._findLifeCycleObserverBindings();
    for (const binding of bindings) {
      const observer = await this.get<LifeCycleObserver>(binding.key);
      if (isLifeCycleObserver(observer)) {
        debug('Starting binding %s...', binding.key);
        await observer.start();
        debug('Binding %s is now started.', binding.key);
      }
    }
    debug('The application is now started.');
  }

  /**
   * Stop the application instance and all of its registered servers.
   * @returns {Promise}
   * @memberof Application
   */
  public async stop(): Promise<void> {
    debug('Stopping the application...');
    const bindings = this._findLifeCycleObserverBindings();
    // Stop in the reverse order
    for (const binding of bindings.reverse()) {
      const observer = await this.get<LifeCycleObserver>(binding.key);
      if (isLifeCycleObserver(observer)) {
        debug('Stopping binding %s...', binding.key);
        await observer.stop();
        debug('Binding %s is now stopped', binding.key);
      }
    }
    debug('The application is now stopped.');
  }

  /**
   * Find all life cycle observer bindings. By default, a constant or singleton
   * binding tagged with `CoreBindings.LIFE_CYCLE_OBSERVER_TAG` or
   * `CoreBindings.SERVER_TAG`.
   */
  protected _findLifeCycleObserverBindings() {
    const bindings = this.find<LifeCycleObserver>(
      binding =>
        (binding.type === BindingType.CONSTANT ||
          binding.scope === BindingScope.SINGLETON) &&
        (binding.tagMap[CoreBindings.LIFE_CYCLE_OBSERVER_TAG] != null ||
          binding.tagMap[CoreBindings.SERVER_TAG]),
    );
    return this._sortLifeCycleObserverBindings(bindings);
  }

  /**
   * Sort the life cycle observer bindings so that we can start/stop them
   * in the right order. By default, we can start other observers before servers
   * and stop them in the reverse order
   * @param bindings Life cycle observer bindings
   */
  protected _sortLifeCycleObserverBindings(
    bindings: Readonly<Binding<LifeCycleObserver>>[],
  ) {
    return bindings.sort((b1, b2) => {
      const tag1 = b1.tagMap[CoreBindings.SERVER_TAG] || '';
      const tag2 = b2.tagMap[CoreBindings.SERVER_TAG] || '';
      return tag1 > tag2 ? 1 : tag1 < tag2 ? -1 : 0;
    });
  }

  /**
   * Add a component to this application and register extensions such as
   * controllers, providers, and servers from the component.
   *
   * @param componentCtor The component class to add.
   * @param {string=} name Optional component name, default to the class name
   *
   * ```ts
   *
   * export class ProductComponent {
   *   controllers = [ProductController];
   *   repositories = [ProductRepo, UserRepo];
   *   providers = {
   *     [AUTHENTICATION_STRATEGY]: AuthStrategy,
   *     [AUTHORIZATION_ROLE]: Role,
   *   };
   * };
   *
   * app.component(ProductComponent);
   * ```
   */
  public component(componentCtor: Constructor<Component>, name?: string) {
    name = name || componentCtor.name;
    const componentKey = `${CoreBindings.COMPONENTS}.${name}`;
    const binding = this.bind(componentKey)
      .toClass(componentCtor)
      .inScope(BindingScope.SINGLETON)
      .tag(CoreBindings.COMPONENT_TAG);
    if (isLifeCycleObserverClass(componentCtor)) {
      binding.apply(asLifeCycleObserverBinding);
    }
    // Assuming components can be synchronously instantiated
    const instance = this.getSync<Component>(componentKey);
    mountComponent(this, instance);
  }

  /**
   * Set application metadata. `@loopback/boot` calls this method to populate
   * the metadata from `package.json`.
   *
   * @param metadata Application metadata
   */
  public setMetadata(metadata: ApplicationMetadata) {
    this.bind(CoreBindings.APPLICATION_METADATA).to(metadata);
  }
}

/**
 * Configuration for application
 */
export interface ApplicationConfig {
  /**
   * Other properties
   */
  // tslint:disable-next-line:no-any
  [prop: string]: any;
}

// tslint:disable-next-line:no-any
export type ControllerClass = Constructor<any>;

/**
 * Type definition for JSON
 */
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export interface JSONObject {
  [property: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}

/**
 * Type description for `package.json`
 */
export interface ApplicationMetadata extends JSONObject {
  name: string;
  version: string;
  description: string;
}
