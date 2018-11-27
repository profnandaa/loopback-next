// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {expect, TestSandbox} from '@loopback/testlab';
import {resolve} from 'path';
import {BooterApp} from '../fixtures/application';
import {CoreBindings, BindingScope} from '@loopback/core';

describe('lifecycle script booter integration tests', () => {
  const SANDBOX_PATH = resolve(__dirname, '../../.sandbox');
  const sandbox = new TestSandbox(SANDBOX_PATH);

  const SCRIPTS_PREFIX = 'lifeCycleObservers';
  const SCRIPTS_TAG = CoreBindings.LIFE_CYCLE_OBSERVER_TAG;

  let app: BooterApp;

  beforeEach('reset sandbox', () => sandbox.reset());
  beforeEach(getApp);

  it('boots scripts when app.boot() is called', async () => {
    const expectedBinding = {
      key: `${SCRIPTS_PREFIX}.MyLifeCycleObserver`,
      tags: [SCRIPTS_TAG],
      scope: BindingScope.SINGLETON,
    };

    await app.boot();

    const bindings = app
      .findByTag(SCRIPTS_TAG)
      .map(b => ({key: b.key, tags: b.tagNames, scope: b.scope}));
    expect(bindings).to.containEql(expectedBinding);
  });

  async function getApp() {
    await sandbox.copyFile(resolve(__dirname, '../fixtures/application.js'));
    await sandbox.copyFile(
      resolve(__dirname, '../fixtures/lifecycle-script.artifact.js'),
      'scripts/lifecycle-script.script.js',
    );

    const MyApp = require(resolve(SANDBOX_PATH, 'application.js')).BooterApp;
    app = new MyApp();
  }
});
