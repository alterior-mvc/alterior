import { expect } from 'chai';
import 'reflect-metadata';
import {
  InjectionToken,
  Injector,
  Provider
} from '.';

import { suite } from 'razmin';
import { inject } from './inject';
import { ResolvedProvider } from './resolved-provider';
import { stringify } from './stringify';
import { THROW_IF_NOT_FOUND } from './throw-if-not-found';

class Engine {}

class BrokenEngine {
  constructor() {
    throw new Error('Broken Engine');
  }
}

class DashboardSoftware {}

class Dashboard {
  software = inject(DashboardSoftware);
}

class TurboEngine extends Engine {}

class Car {
  engine = inject(Engine);
}

class CarWithOptionalEngine {
  engine = inject(Engine, { optional: true });
}

class CarWithDashboard {
  engine = inject(Engine);
  dashboard = inject(Dashboard);
}

class SportsCar extends Car {}

class CarWithInject {
  engine: Engine = inject(TurboEngine);
}

class CyclicEngine {
  car = inject(Car);
}

/////////////////////////////

class Engine2 {}
class TurboEngine2 extends Engine {}

class SportsCar2 extends Car {}

class CarWithInject2 {
  engine = inject(TurboEngine2);
}

class CyclicEngine2 {
  car = inject(Car);
}

/////////////////////////////

class NoAnnotations {
  constructor(secretDependency: any) {}
}

function factoryFn(a: any) {}

const dynamicProviders = [
  { provide: 'provider0', useValue: 1 },
  { provide: 'provider1', useValue: 1 },
  { provide: 'provider2', useValue: 1 },
  { provide: 'provider3', useValue: 1 },
  { provide: 'provider4', useValue: 1 },
  { provide: 'provider5', useValue: 1 },
  { provide: 'provider6', useValue: 1 },
  { provide: 'provider7', useValue: 1 },
  { provide: 'provider8', useValue: 1 },
  { provide: 'provider9', useValue: 1 },
  { provide: 'provider10', useValue: 1 },
];

function createInjector(providers: Provider[], parent: Injector | null = null): Injector {
  const resolvedProviders = Injector.resolve(providers.concat(dynamicProviders));
  if (parent !== null) {
    return parent.createChildFromResolved(resolvedProviders) as Injector;
  } else {
    return Injector.fromResolvedProviders(resolvedProviders) as Injector;
  }
}

suite(describe => {
  describe('Injector.empty', it => {
    it('should throw if no arg is given', () => {
      expect(() => Injector.empty.get('someToken')).to.throw('No provider for someToken!');
    });

    it('should throw if THROW_IF_NOT_FOUND is given', () => {
      expect(() => Injector.empty.get('someToken', THROW_IF_NOT_FOUND)).to.throw('No provider for someToken!');
    });

    it('should return the default value', () => {
      expect(Injector.empty.get('someToken', 'notFound')).to.equal('notFound');
    });
  });
  describe(`Injector`, it => {
    it('should instantiate a class without dependencies', () => {
      const injector = createInjector([Engine]);
      const engine = injector.get(Engine);

      expect(engine instanceof Engine).to.be.ok;
    });

    it('should resolve dependencies based on type information', () => {
      const injector = createInjector([Engine, Car]);
      const car = injector.get(Car);

      expect(car).to.be.instanceOf(Car);
      expect(car.engine).to.be.an.instanceOf(Engine);
    });

    it('should resolve dependencies based on @Inject annotation', () => {
      const injector = createInjector([TurboEngine, Engine, CarWithInject]);
      const car = injector.get(CarWithInject);

      expect(car).to.be.instanceOf(CarWithInject);
      expect(car.engine).to.be.instanceOf(TurboEngine);
    });

    it('should resolve imperative dependencies', () => {
      const injector = createInjector([TurboEngine2, Engine2, CarWithInject2]);
      const car = injector.get(CarWithInject2);

      expect(car).to.be.instanceOf(CarWithInject2);
      expect(car.engine).to.be.instanceOf(TurboEngine2);
    });

    it('should throw when inject() is called outside of injection context', () => {
      expect(() => inject(CarWithInject2)).to.throw();
    });

    it('should cache instances', () => {
      const injector = createInjector([Engine]);

      const e1 = injector.get(Engine);
      const e2 = injector.get(Engine);

      expect(e1).to.eq(e2);
    });

    it('should provide to a value', () => {
      const injector = createInjector([{ provide: Engine, useValue: 'fake engine' }]);

      const engine = injector.get(Engine);
      expect(engine).to.eq('fake engine');
    });

    it('should inject dependencies within factories', () => {
      const TOKEN = new InjectionToken<string>('token');

      const injector = createInjector([
        { provide: TOKEN, useValue: 'by token' },
        { provide: Engine, useFactory: () => inject(TOKEN) },
      ]);

      const engine = injector.get(Engine);
      expect(engine).to.eq('by token');
    });

    it('should supporting provider to null', () => {
      const injector = createInjector([{ provide: Engine, useValue: null }]);
      const engine = injector.get(Engine);
      expect(engine).to.be.null;
    });

    it('should provide to an alias', () => {
      const injector = createInjector([Engine, { provide: SportsCar, useClass: SportsCar }, { provide: Car, useExisting: SportsCar }]);

      const car = injector.get(Car);
      const sportsCar = injector.get(SportsCar);
      expect(car instanceof SportsCar).to.be.ok;
      expect(car).to.eq(sportsCar);
    });

    it('should support multiProviders', () => {
      const injector = createInjector([
        Engine,
        { provide: Car, useClass: SportsCar, multi: true },
        { provide: Car, useClass: CarWithOptionalEngine, multi: true },
      ]);

      const cars = injector.get(Car);
      expect(cars.length).to.equal(2);
      expect(cars[0] instanceof SportsCar).to.be.ok;
      expect(cars[1] instanceof CarWithOptionalEngine).to.be.ok;
    });

    it('should support multiProviders that are created using useExisting', () => {
      const injector = createInjector([Engine, SportsCar, { provide: Car, useExisting: SportsCar, multi: true }]);

      const cars = injector.get(Car);
      expect(cars.length).to.equal(1);
      expect(cars[0]).to.eq(injector.get(SportsCar));
    });

    it('should throw when the aliased provider does not exist', () => {
      const injector = createInjector([{ provide: 'car', useExisting: SportsCar }]);
      const e = `No provider for ${stringify(SportsCar)}! (car -> ${stringify(SportsCar)})`;
      expect(() => injector.get('car')).to.throw(e);
    });

    it('should handle forwardRef in useExisting', () => {
      const injector = createInjector([
        { provide: 'originalEngine', useClass: () => Engine },
        { provide: 'aliasedEngine', useExisting: () => 'originalEngine' },
      ]);
      expect(injector.get('aliasedEngine') instanceof Engine).to.be.ok;
    });

    it('should support optional dependencies', () => {
      const injector = createInjector([CarWithOptionalEngine]);

      const car = injector.get(CarWithOptionalEngine);
      expect(car.engine).to.equal(null);
    });

    it('should flatten passed-in providers', () => {
      const injector = createInjector([[[Engine, Car]]]);

      const car = injector.get(Car);
      expect(car instanceof Car).to.be.ok;
    });

    it('should use the last provider when there are multiple providers for same token', () => {
      const injector = createInjector([{ provide: Engine, useClass: Engine }, { provide: Engine, useClass: TurboEngine }]);

      expect(injector.get(Engine) instanceof TurboEngine).to.be.ok;
    });

    it('should use non-type tokens', () => {
      const injector = createInjector([{ provide: 'token', useValue: 'value' }]);

      expect(injector.get('token')).to.equal('value');
    });

    it('should throw when given invalid providers', () => {
      expect(() => createInjector(<any>['blah'])).to.throw(
        'Invalid provider - only instances of Provider and Type are allowed, got: blah'
      );
    });

    it('should provide itself', () => {
      const parent = createInjector([]);
      const child = parent.resolveAndCreateChild([]);

      expect(child.get(Injector)).to.eq(child);
    });

    it('should throw when no provider defined', () => {
      const injector = createInjector([]);
      expect(() => injector.get('NonExisting')).to.throw('No provider for NonExisting!');
    });

    it('should show the full path when no provider', () => {
      const injector = createInjector([CarWithDashboard, Engine, Dashboard]);
      expect(() => injector.get(CarWithDashboard)).to.throw(
        `No provider for DashboardSoftware! (${stringify(CarWithDashboard)} -> ${stringify(Dashboard)} -> DashboardSoftware)`
      );
    });

    it('should throw when trying to instantiate a cyclic dependency', () => {
      const injector = createInjector([Car, { provide: Engine, useClass: CyclicEngine }]);

      expect(() => injector.get(Car)).to.throw(
        `Cannot instantiate cyclic dependency! (${stringify(Car)} -> ${stringify(Engine)} -> ${stringify(Car)})`
      );
    });

    it('should show the full path when error happens in a constructor', () => {
      const providers = Injector.resolve([Car, { provide: Engine, useClass: BrokenEngine }]);
      const injector = Injector.fromResolvedProviders(providers);

      try {
        injector.get(Car);
        throw 'Must throw';
      } catch (e: any) {
        expect(e.message).to.contain(`Error during instantiation of Engine! (${stringify(Car)} -> Engine)`);
        expect(e.cause instanceof Error).to.be.ok;
        expect(e.keys[0].token).to.equal(Engine);
      }
    });

    it('should instantiate an object after a failed attempt', () => {
      let isBroken = true;

      const injector = createInjector([Car, { provide: Engine, useFactory: () => (isBroken ? new BrokenEngine(): new Engine()) }]);

      expect(() => injector.get(Car)).to.throw('Broken Engine: Error during instantiation of Engine! (Car -> Engine).');

      isBroken = false;

      expect(injector.get(Car) instanceof Car).to.be.ok;
    });

    it('should support null values', () => {
      const injector = createInjector([{ provide: 'null', useValue: null }]);
      expect(injector.get('null')).to.eq(null);
    });
  });

  describe('child', it => {
    it('should load instances from parent injector', () => {
      const parent = Injector.resolveAndCreate([Engine]);
      const child = parent.resolveAndCreateChild([]);

      const engineFromParent = parent.get(Engine);
      const engineFromChild = child.get(Engine);

      expect(engineFromChild).to.eq(engineFromParent);
    });

    it('should not use the child providers when resolving the dependencies of a parent provider', () => {
      const parent = Injector.resolveAndCreate([Car, Engine]);
      const child = parent.resolveAndCreateChild([{ provide: Engine, useClass: TurboEngine }]);

      const carFromChild = child.get(Car);
      expect(carFromChild.engine instanceof Engine).to.be.ok;
    });

    it('should create new instance in a child injector', () => {
      const parent = Injector.resolveAndCreate([Engine]);
      const child = parent.resolveAndCreateChild([{ provide: Engine, useClass: TurboEngine }]);

      const engineFromParent = parent.get(Engine);
      const engineFromChild = child.get(Engine);

      expect(engineFromParent).not.to.eq(engineFromChild);
      expect(engineFromChild instanceof TurboEngine).to.be.ok;
    });

    it('should give access to parent', () => {
      const parent = Injector.resolveAndCreate([]);
      const child = parent.resolveAndCreateChild([]);
      expect(child.parent).to.eq(parent);
    });
  });

  describe('resolveAndInstantiate', it => {
    it('should instantiate an object in the context of the injector', () => {
      const inj = Injector.resolveAndCreate([Engine]);
      const car = inj.resolveAndInstantiate(Car);
      expect(car instanceof Car).to.be.ok;
      expect(car.engine).to.eq(inj.get(Engine));
    });

    it('should not store the instantiated object in the injector', () => {
      const inj = Injector.resolveAndCreate([Engine]);
      inj.resolveAndInstantiate(Car);
      expect(() => inj.get(Car)).to.throw();
    });
  });

  describe('instantiate', it => {
    it('should instantiate an object in the context of the injector', () => {
      const inj = Injector.resolveAndCreate([Engine]);
      const car = inj.instantiate(Injector.resolve([Car])[0]);
      expect(car instanceof Car).to.be.ok;
      expect(car.engine).to.eq(inj.get(Engine));
    });
  });

  describe('dependency resolution', it => {
    describe('@Self()', () => {
      class Car {
        engine = inject(Engine, { self: true });
      }

      it('should return a dependency from self', () => {

        const inj = Injector.resolveAndCreate([
          Engine, 
          Car
        ]);

        expect(inj.get(Car) instanceof Car).to.be.ok;
      });

      it('should throw when not requested provider on self', () => {
        const parent = Injector.resolveAndCreate([Engine]);
        const child = parent.resolveAndCreateChild([Car]);
        expect(() => child.get(Car)).to.throw(`No provider for Engine!`);
      });
    });

    describe('default', () => {
      it('should not skip self', () => {
        const parent = Injector.resolveAndCreate([Engine]);
        const child = parent.resolveAndCreateChild([
          { provide: Engine, useClass: TurboEngine },
          { provide: Car, useClass: Car },
        ]);

        expect(child.get(Car).engine instanceof TurboEngine).to.be.ok;
      });
    });
  });

  describe('resolve', it => {
    it('should resolve and flatten', () => {
      const providers = Injector.resolve([Engine, [BrokenEngine]]);
      providers.forEach(function(b) {
        if (!b) return; // the result is a sparse array
        expect(b instanceof ResolvedProvider).to.eq(true);
      });
    });

    it('should support multi providers', () => {
      const provider = Injector.resolve([
        { provide: Engine, useClass: BrokenEngine, multi: true },
        { provide: Engine, useClass: TurboEngine, multi: true },
      ])[0];

      expect(provider.key.token).to.eq(Engine);
      expect(provider.multi).to.equal(true);
      expect(provider.resolvedFactories.length).to.equal(2);
    });

    it('should support providers as hash', () => {
      const provider = Injector.resolve([
        { provide: Engine, useClass: BrokenEngine, multi: true },
        { provide: Engine, useClass: TurboEngine, multi: true },
      ])[0];

      expect(provider.key.token).to.eq(Engine);
      expect(provider.multi).to.equal(true);
      expect(provider.resolvedFactories.length).to.equal(2);
    });

    it('should support multi providers with only one provider', () => {
      const provider = Injector.resolve([{ provide: Engine, useClass: BrokenEngine, multi: true }])[0];

      expect(provider.key.token).to.eq(Engine);
      expect(provider.multi).to.equal(true);
      expect(provider.resolvedFactories.length).to.equal(1);
    });

    it('should throw when mixing multi providers with regular providers', () => {
      expect(() => {
        Injector.resolve([{ provide: Engine, useClass: BrokenEngine, multi: true }, Engine]);
      }).to.throw(/Cannot mix multi providers and regular providers/);

      expect(() => {
        Injector.resolve([Engine, { provide: Engine, useClass: BrokenEngine, multi: true }]);
      }).to.throw(/Cannot mix multi providers and regular providers/);
    });

    it('should resolve forward references', () => {
      const providers = Injector.resolve([
        () => Engine,
        [{ provide: () => BrokenEngine, useClass: () => Engine }],
      ]);

      const engineProvider = providers[0];
      const brokenEngineProvider = providers[1];

      expect(engineProvider.resolvedFactories[0]() instanceof Engine).to.eq(true);
      expect(brokenEngineProvider.resolvedFactories[0]() instanceof Engine).to.eq(true);
    });
  });

  describe('displayName', it => {
    it('should work', () => {
      expect((<Injector>Injector.resolveAndCreate([Engine, BrokenEngine])).displayName).to.equal(
        'Injector(providers: [ "Engine" ,  "BrokenEngine" ])'
      );
    });
  });
});