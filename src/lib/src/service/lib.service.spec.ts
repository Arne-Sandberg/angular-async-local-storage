import { map, first, take } from 'rxjs/operators';

import { LocalStorage } from './lib.service';
import { IndexedDBDatabase } from './databases/indexeddb-database';
import { LocalStorageDatabase } from './databases/localstorage-database';
import { MockLocalDatabase } from './databases/mock-local-database';
import { JSONSchema } from './validation/json-schema';
import { JSONValidator } from './validation/json-validator';
import { AsyncLocalStorage } from '../../index';

function testGetItem<T>(type: 'primitive' | 'object', localStorage: LocalStorage, value: T, done: DoneFn) {

  localStorage.setItem('test', value).subscribe(() => {

    localStorage.getItem<T>('test').subscribe((data) => {

      if (type === 'primitive') {
        expect(data).toBe(value);
      } else {
        expect(data).toEqual(value);
      }

      done();

    });

  });

}

function testGetItemPrimitive<T>(localStorage: LocalStorage, value: T, done: DoneFn) {

  testGetItem<T>('primitive', localStorage, value, done);

}

function testGetItemObject<T>(localStorage: LocalStorage, value: T, done: DoneFn) {

  testGetItem<T>('object', localStorage, value, done);

}

function tests(localStorage: LocalStorage) {

  it('should return null on unknown index', (done: DoneFn) => {

    localStorage.getItem('unknown').subscribe((data) => {

      expect(data).toBeNull();

      done();

    });

  });

  it('should store and return a string', (done: DoneFn) => {

    testGetItemPrimitive<string>(localStorage, 'blue', done);

  });

  it('should store and return an empty string', (done: DoneFn) => {

    testGetItemPrimitive<string>(localStorage, '', done);

  });

  it('should store and return a number', (done: DoneFn) => {

    testGetItemPrimitive<number>(localStorage, 10, done);

  });

  it('should store and return zero', (done: DoneFn) => {

    testGetItemPrimitive<number>(localStorage, 0, done);

  });

  it('should store and return true', (done: DoneFn) => {

    testGetItemPrimitive<boolean>(localStorage, true, done);

  });

  it('should store and return false', (done: DoneFn) => {

    testGetItemPrimitive<boolean>(localStorage, false, done);

  });

  it('should store and return null', (done: DoneFn) => {

    testGetItemPrimitive<null>(localStorage, null, done);

  });

  it('should store and return null for undefined too', (done: DoneFn) => {

    localStorage.setItem('test', undefined).subscribe(() => {

      localStorage.getItem('test').subscribe((data) => {

        expect(data).toBe(null);

        done();

      });

    });

  });

  it('should store and return an array', (done: DoneFn) => {

    testGetItemObject<number[]>(localStorage, [1, 2, 3], done);

  });

  it('should store and return an object', (done: DoneFn) => {

    testGetItemObject<{name: string}>(localStorage, { name: 'test' }, done);

  });

  it('should return null on deleted index', (done: DoneFn) => {

    const index = 'test';

    localStorage.setItem(index, 'test').subscribe(() => {

      localStorage.removeItem(index).subscribe(() => {

        localStorage.getItem<string>(index).subscribe((data) => {

          expect(data).toBeNull();

          done();

        });

      });

    });

  });

  it('should allow to use operators', (done: DoneFn) => {

    const index = 'index';
    const value = 'value';

    localStorage.setItem(index, value).subscribe(() => {

      localStorage.getItem<string>(index).pipe(map((data) => data)).subscribe((data) => {

        expect(data).toBe(value);

        done();

      });

    });

  });

  it('should call error callback if data is invalid against JSON schema', (done: DoneFn) => {

    const index = 'index';
    const value = {
      unexpected: 'value'
    };
    const schema: JSONSchema = {
      properties: {
        expected: {
          type: 'string'
        }
      },
      required: ['expected']
    };

    localStorage.setItem(index, value).subscribe(() => {

      localStorage.getItem<{ expected: string }>(index, { schema }).subscribe((data) => {

        fail();

        done();

      }, (error) => {

        expect(error.message).toBe(`JSON invalid`);

        done();

      });

    });

  });

  it('should call error callback if the JSON schema itself is invalid', (done: DoneFn) => {

    const index = 'doesnotmatter';
    const value = 'doesnotmatter';
    const schema: JSONSchema = {
      required: ['expected']
    };

    localStorage.setItem(index, value).subscribe(() => {

      localStorage.getItem(index, { schema }).subscribe((data) => {

        fail();

        done();

      }, (error) => {

        expect(error).toBeTruthy();

        done();

      });

    });

  });

  it('should return the data if JSON schema is valid', (done: DoneFn) => {

    const index = 'index';
    const value = {
      expected: 'value'
    };
    const schema: JSONSchema = {
      properties: {
        expected: {
          type: 'string'
        }
      },
      required: ['expected']
    };

    localStorage.setItem(index, value).subscribe(() => {

      localStorage.getItem<{ expected: string }>(index, { schema }).subscribe((data) => {

        expect(data).toEqual(value);

        done();

      }, () => {

        fail();

        done();

      });

    });

  });

  it('should return the data if the data is null (no validation)', (done: DoneFn) => {

    const schema: JSONSchema = {
      properties: {
        expected: {
          type: 'string'
        }
      },
      required: ['expected']
    };

    localStorage.getItem<{ expected: string }>('notexisting', { schema }).subscribe((data) => {

      expect((data)).toBeNull();

      done();

    }, () => {

      fail();

      done();

    });

  });

  it('should call complete on setItem', (done: DoneFn) => {

    localStorage.setItem('index', 'value').subscribe({ complete: () => { done(); } });

  });

  it('should call complete on existing getItem', (done: DoneFn) => {

    const index = 'index';
    const value = 'value';

    localStorage.setItem(index, value).subscribe(() => {

      localStorage.getItem<string>(index).subscribe({ complete: () => { done(); } });

    });

  });

  it('should call complete on unexisting getItem', (done: DoneFn) => {

    localStorage.getItem<string>('notexisting').subscribe({ complete: () => { done(); } });

  });

  it('should call complete on existing removeItem', (done: DoneFn) => {

    const index = 'index';

    localStorage.setItem(index, 'value').subscribe(() => {

      localStorage.removeItem(index).subscribe({ complete: () => { done(); } });

    });

  });

  it('should call complete on unexisting removeItem', (done: DoneFn) => {

    localStorage.removeItem('notexisting').subscribe({ complete: () => { done(); } });

  });

  it('should call complete on clear', (done: DoneFn) => {

    localStorage.clear().subscribe({ complete: () => { done(); } });

  });

  it('should be OK if user manually used first() to complete', (done: DoneFn) => {

    localStorage.clear().pipe(first()).subscribe({ complete: () => { done(); } });

  });

  it('should be OK if user manually used take(1) to complete', (done: DoneFn) => {

    localStorage.clear().pipe(take(1)).subscribe({ complete: () => { done(); } });

  });

  it('should be able to update an existing index', (done: DoneFn) => {

    const index = 'index';

    localStorage.setItem(index, 'value').subscribe(() => {

      localStorage.setItem(index, 'updated').subscribe(() => {
        done();
      }, () => {
        fail();
      });

    });

  });

  it('should work in a Promise-way', (done: DoneFn) => {

    const index = 'index';
    const value = 'test';

    localStorage.setItem(index, value).toPromise()
    .then(() => localStorage.getItem(index).toPromise())
    .then((result) => {
      expect(result).toBe(value);
      done();
    }, () => {
      fail();
    });

  });

  it('should set item and auto-subscribe', (done: DoneFn) => {

    const index = 'index';
    const value = 'test';


    localStorage.setItemSubscribe(index, value);

    window.setTimeout(() => {

      localStorage.getItem<string>(index).subscribe((data) => {
        expect(data).toBe(value);
        done();
      }, () => {
        fail();
      });

    }, 50);

  });

  it('should remove item and auto-subscribe', (done: DoneFn) => {

    const index = 'index';
    const value = 'test';

    localStorage.setItem(index, value).subscribe(() => {

      localStorage.removeItemSubscribe(index);

      window.setTimeout(() => {

        localStorage.getItem<string>(index).subscribe((data) => {
          expect(data).toBe(null);
          done();
        }, () => {
          fail();
        });

      }, 50);

    });

  });

  it('should clear storage and auto-subscribe', (done: DoneFn) => {

    const index = 'index';
    const value = 'test';

    localStorage.setItem(index, value).subscribe(() => {

      localStorage.clearSubscribe();

      window.setTimeout(() => {

        localStorage.getItem<string>(index).subscribe((data) => {
          expect(data).toBe(null);
          done();
        }, () => {
          fail();
        });

      }, 50);

    });

  });

  it('should not cause concurrency issue when not waiting setItem to be done', (done: DoneFn) => {

    const index = 'index';
    const value1 = 'test1';
    const value2 = 'test2';

    expect(() => {

      localStorage.setItem(index, value1).subscribe();

      localStorage.setItem(index, value2).subscribe(() => {

        localStorage.getItem(index).subscribe((result) => {

          expect(result).toBe(value2);

          done();

        });

      });

    }).not.toThrow();

  });

}

describe('LocalStorage with mock storage', () => {

  let localStorage = new LocalStorage(new MockLocalDatabase(), new JSONValidator());

  beforeEach((done: DoneFn) => {
    localStorage.clear().subscribe(() => {
      done();
    });
  });

  tests(localStorage);

});

describe('LocalStorage with localStorage', () => {

  let localStorage = new LocalStorage(new LocalStorageDatabase(null), new JSONValidator());

  beforeEach((done: DoneFn) => {
    localStorage.clear().subscribe(() => {
      done();
    });
  });

  tests(localStorage);

});

describe('LocalStorage with localStorage with prefix', () => {

  let localStorage = new LocalStorage(new LocalStorageDatabase('myapp'), new JSONValidator());

  beforeEach((done: DoneFn) => {
    localStorage.clear().subscribe(() => {
      done();
    });
  });

  tests(localStorage);

});

describe('LocalStorage with IndexedDB', () => {

  let localStorage = new LocalStorage(new IndexedDBDatabase(), new JSONValidator());

  beforeEach((done: DoneFn) => {
    localStorage.clear().subscribe(() => {
      done();
    });
  });

  tests(localStorage);

  function testSetCompatibilityWithNativeAPI(done: DoneFn, value: any) {

    const index = 'test';

    indexedDB.open('ngStorage').addEventListener('success', (openEvent) => {

      const database = (openEvent.target as IDBRequest).result as IDBDatabase;

      const localStorageObject = database.transaction(['localStorage'], 'readwrite').objectStore('localStorage');

      localStorageObject.add(value, index).addEventListener('success', () => {

        localStorage.setItem(index, 'world').subscribe(() => {

          done();

        });

      });

    });

  }

  function testgetCompatibilityWithNativeAPI(done: DoneFn, value: any, schema: JSONSchema) {

    const index = 'test';

    indexedDB.open('ngStorage').addEventListener('success', (openEvent) => {

      const database = (openEvent.target as IDBRequest).result as IDBDatabase;

      const localStorageObject = database.transaction(['localStorage'], 'readwrite').objectStore('localStorage');

      localStorageObject.add(value, index).addEventListener('success', () => {

        localStorage.getItem(index, { schema }).subscribe((result) => {

          expect(result).toEqual((value !== undefined) ? value : null);

          done();

        });

      });

    });

  }

  const setTestValues = ['hello', '', 0, false, null, undefined];

  for (const setTestValue of setTestValues) {

    it('should store a value on an index previously used by a native or other lib API', (done: DoneFn) => {

      testSetCompatibilityWithNativeAPI(done, setTestValue);

    });

  }

  const getTestValues: [any, JSONSchema][] = [
    ['hello', { type: 'string' }],
    ['', { type: 'string' }],
    [1, { type: 'number' }],
    [0, { type: 'number' }],
    [true, { type: 'boolean' }],
    [false, { type: 'boolean' }],
    [null, { type: 'null' }],
    [undefined, { type: 'null' }],
    [[1, 2, 3], { items: { type: 'number' } }],
    [{ test: 'value' }, { properties: { test: { type: 'string' } } }],
  ];

  for (const [getTestValue, getTestSchema] of getTestValues) {

    it('should get a value on an index previously used by a native or other lib API', (done: DoneFn) => {

      testgetCompatibilityWithNativeAPI(done, getTestValue, getTestSchema);

    });

  }

});

describe('LocalStorage with IndexedDB with prefix', () => {

  let localStorage = new LocalStorage(new IndexedDBDatabase('myapp'), new JSONValidator());

  beforeEach((done: DoneFn) => {
    localStorage.clear().subscribe(() => {
      done();
    });
  });

  tests(localStorage);

});

describe('AsyncLocalStorage with IndexedDB', () => {

  let localStorage = new AsyncLocalStorage(new IndexedDBDatabase(), new JSONValidator());

  beforeEach((done: DoneFn) => {
    localStorage.clear().subscribe(() => {
      done();
    });
  });

  tests(localStorage);

});
