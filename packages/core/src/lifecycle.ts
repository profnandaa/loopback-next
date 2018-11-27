// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Constructor, Binding, BindingScope} from '@loopback/context';
import {CoreBindings} from './keys';
/**
 * Observers to handle life cycle start/stop events
 */
export interface LifeCycleObserver {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
}

/**
 * Test if an object implements LifeCycleObserver
 * @param obj An object
 */
export function isLifeCycleObserver(obj: {
  [name: string]: unknown;
}): obj is LifeCycleObserver {
  return typeof obj.start === 'function' && typeof obj.stop === 'function';
}

/**
 * Test if a class implements LifeCycleObserver
 * @param ctor A class
 */
export function isLifeCycleObserverClass(
  ctor: Constructor<unknown>,
): ctor is Constructor<LifeCycleObserver> {
  return (
    ctor.prototype &&
    typeof ctor.prototype.start === 'function' &&
    typeof ctor.prototype.stop === 'function'
  );
}

/**
 * Configure the binding as life cycle observer
 * @param binding Binding
 */
export function asLifeCycleObserverBinding<T = unknown>(binding: Binding<T>) {
  return binding
    .tag(CoreBindings.LIFE_CYCLE_OBSERVER_TAG)
    .inScope(BindingScope.SINGLETON);
}
