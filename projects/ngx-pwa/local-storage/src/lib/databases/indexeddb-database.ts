import { Injectable, Optional, Inject } from '@angular/core';
import { Observable, ReplaySubject, fromEvent, of, throwError, race } from 'rxjs';
import { map, mergeMap, first, tap, filter } from 'rxjs/operators';

import { LocalDatabase } from './local-database';
import { LocalStorageDatabase } from './localstorage-database';
import { PREFIX, IDB_DB_NAME, DEFAULT_IDB_DB_NAME, IDB_STORE_NAME, DEFAULT_IDB_STORE_NAME } from '../tokens';

@Injectable({
  providedIn: 'root'
})
export class IndexedDBDatabase implements LocalDatabase {

  /**
   * `indexedDB` database name
   */
  protected dbName: string;

  /**
   * `indexedDB` object store name
   */
  protected storeName: string;

  /**
   * `indexedDB` data path name for local storage (where items' value will be stored)
   */
  private readonly dataPath = 'value';

  /**
   * `indexedDB` database connection, wrapped in a RxJS `ReplaySubject` to be able to access the connection
   * even after the connection success event happened
   */
  private database: ReplaySubject<IDBDatabase>;

  /**
   * `indexedDB` is available but failing in some scenarios (some browsers private mode...),
   * so a fallback can be needed.
   */
  private fallback: LocalDatabase | null = null;

  /**
   * Number of items in our `indexedDB` database and object store
   */
  get size(): Observable<number> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.size;
    }

    /* Open a transaction in read-only mode */
    return this.transaction('readonly').pipe(
      mergeMap((store) => {

        /* Request to know the number of items */
        const request = store.count();

        /* Manage success and error events, and get the result */
        return this.requestEventsAndMapTo(request, () => request.result);

      }),
      /* The observable will complete after the first value */
      first(),
    );

  }

  /**
   * Constructor params are provided by Angular (but can also be passed manually in tests)
   * @param prefix Optional user prefix to avoid collision for multiple apps on the same subdomain
   * @param dbName `indexedDB` database name
   * @param storeName `indexedDB` store name
   */
  constructor(
    @Optional() @Inject(PREFIX) prefix: string | null = null,
    @Optional() @Inject(IDB_DB_NAME) dbName = DEFAULT_IDB_DB_NAME,
    @Optional() @Inject(IDB_STORE_NAME) storeName = DEFAULT_IDB_STORE_NAME,
  ) {

    /* Initialize `indexedDB` database name, with prefix if provided by the user */
    this.dbName = prefix ? `${prefix}_${dbName}` : dbName;

    /* Initialize `indexedDB` store name */
    this.storeName = storeName;

    /* Creating the RxJS ReplaySubject */
    this.database = new ReplaySubject<IDBDatabase>();

    /* Connect to `indexedDB`, with prefix if provided by the user */
    this.connect(prefix);

  }

  /**
   * Gets an item value in our `indexedDB` store
   * @param key The item's key
   * @returns The item's value if the key exists, `null` otherwise, wrapped in an RxJS `Observable`
   */
  getItem<T = any>(key: string): Observable<T | null> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.getItem<T>(key);
    }

    /* Open a transaction in read-only mode */
    return this.transaction('readonly').pipe(
      mergeMap((store) => {

        /* Request the value with the key provided by the user */
        const request = store.get(key);

        /* Manage success and error events, and get the result */
        return this.requestEventsAndMapTo(request, () => {

          /* Currently, the lib is wrapping the value in a `{ value: ... }` object, so test this case */
          // TODO: add a check to see if the object has only one key
          // TODO: stop wrapping
          if ((request.result !== undefined)
          && (request.result !== null)
          && (typeof request.result === 'object')
          && (this.dataPath in request.result)
          && (request.result[this.dataPath] !== undefined)
          && (request.result[this.dataPath] !== null)) {

            /* If so, unwrap the value and cast it to the wanted type */
            return (request.result[this.dataPath] as T);

          } else if ((request.result !== undefined) && (request.result !== null)) {

            /* Otherwise, return the value directly, casted to the wanted type */
            return request.result as T;

          }

          /* Return `null` if the value is `null` or `undefined` */
          return null;

        });

      }),
      /* The observable will complete after the first value */
      first(),
    );

  }

  /**
   * Sets an item in our `indexedDB` store
   * @param key The item's key
   * @param data The item's value
   * @returns An RxJS `Observable` to wait the end of the operation
   */
  setItem(key: string, data: string | number | boolean | object): Observable<boolean> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.setItem(key, data);
    }

    /* Storing `null` or `undefined` is known to cause issues in some browsers.
     * So it's useless, not storing anything in this case */
    if ((data === undefined) || (data === null)) {

      /* Trigger success */
      return of(true);

    }

    /* Open a transaction in write mode */
    return this.transaction('readwrite').pipe(
      mergeMap((store) => {

        /* Check if the key already exists or not
         * `getKey()` is better but only available in `indexedDB` v2 (Chrome >= 58, missing in IE/Edge).
         * In older browsers, the value is checked instead, but it could lead to an exception
         * if `undefined` was stored outside of this lib (e.g. directly with the native `indexedDB` API).
         */
        const request = this.getKeyRequest(store, key);

        /* Manage success and error events, and get the request result */
        return this.requestEventsAndMapTo(request, () => request.result).pipe(
          mergeMap((existingEntry) => {

            /* Add if the item is not existing yet, or update otherwise */
            // TODO: stop wrapping
            const request = (existingEntry === undefined) ?
              store.add({ [this.dataPath]: data }, key) :
              store.put({ [this.dataPath]: data }, key);

            /* Manage success and error events, and map to `true` */
            return this.requestEventsAndMapTo(request, () => true);

          }),
        );
      }),
      /* The observable will complete after the first value */
      first(),
    );

  }

  /**
   * Deletes an item in our `indexedDB` store
   * @param key The item's key
   * @returns An RxJS `Observable` to wait the end of the operation
   */
  removeItem(key: string): Observable<boolean> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.removeItem(key);
    }

    /* Open a transaction in write mode */
    return this.transaction('readwrite').pipe(
      mergeMap((store) => {

        /* Deletethe item in store */
        const request = store.delete(key);

        /* Manage success and error events, and map to `true` */
        return this.requestEventsAndMapTo(request, () => true);

      }),
      /* The observable will complete after the first value */
      first()
    );

  }

  /**
   * Deletes all items from our `indexedDB` objet store
   * @returns An RxJS `Observable` to wait the end of the operation
   */
  clear(): Observable<boolean> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.clear();
    }

    /* Open a transaction in write mode */
    return this.transaction('readwrite').pipe(
      mergeMap((store) => {

        /* Delete all items in object store */
        const request = store.clear();

        /* Manage success and error events, and map to `true` */
        return this.requestEventsAndMapTo(request, () => true);

      }),
      /* The observable will complete */
      first(),
    );

  }

  /**
   * Get all the keys in our `indexedDB` store
   * @returns An RxJS `Observable` containing all the keys
   */
  keys(): Observable<string[]> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.keys();
    }

    /* Open a transaction in read-only mode */
    return this.transaction('readonly').pipe(
      mergeMap((store) => {

        /* `getAllKey()` is better but only available in `indexedDB` v2 (Chrome >= 58, missing in IE/Edge) */
        if ('getAllKeys' in store) {

          /* Request all keys in store */
          const request = store.getAllKeys();

          /* Manage success and error events, and map to result
           * Cast to `string[]` instead of `IDBValidKey[]` as the user must not be concerned about specific implementations */
          // TODO: check if all keys can be considered as string
          return this.requestEventsAndMapTo(request, () => request.result as string[]);

        } else {

          /* Open a cursor on the store */
          const request = (store as IDBObjectStore).openCursor();

          /* Listen to success event */
          const success$ = this.getKeysFromCursor(request);

          /* Listen to error event and if so, throw an error */
          const error$ = this.errorEvent(request);

          /* Choose the first event to occur */
          return race([success$, error$]);

        }

      }),
      /* The observable will complete */
      first(),
    );

  }

  /**
   * Check if a key exists in our `indexedDB` store
   * @returns An RxJS `Observable` telling if the key exists or not
   */
  has(key: string): Observable<boolean> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.has(key);
    }

    /* Open a transaction in read-only mode */
    return this.transaction('readonly').pipe(
      mergeMap((store) => {

        /* Check if the key exists in the store */
        const request = this.getKeyRequest(store, key);

        /* Manage success and error events, and map to a boolean based on the existence of the key */
        return this.requestEventsAndMapTo(request, () => (request.result !== undefined) ? true : false);

      }),
      /* The observable will complete */
      first()
    );

  }

  /**
   * Connects to `indexedDB` and creates the object store on first time
   * @param prefix
   */
  private connect(prefix: string | null = null): void {

    let request: IDBOpenDBRequest;

    /* Connect to `indexedDB` */
    try {

      // TODO: Could be catch earlier when detecting storage support
      request = indexedDB.open(this.dbName);

    } catch (error) {

      /* Fallback storage if IndexedDb connection is failing
       * Safari cross-origin iframes
       * @see https://github.com/cyrilletuzi/angular-async-local-storage/issues/42
       */
      this.setFallback(prefix);

      return;

    }

    /* Create store on first connection */
    this.createStore(request);

    /* Listen to success and error events and choose the first to occur */
    race([this.successEvent(request), this.errorEvent(request)])
      /* The observable will complete */
      .pipe(first())
      .subscribe(() => {

        /* Register the database connection in the `ReplaySubject` for further access */
        this.database.next(request.result);

      }, () => {

        /* Firefox private mode issue: fallback storage if IndexedDb connection is failing
         * @see https://bugzilla.mozilla.org/show_bug.cgi?id=781982
         * @see https://github.com/cyrilletuzi/angular-async-local-storage/issues/26 */
        this.setFallback(prefix);

      });

  }

  /**
   * Create store on first use of `indexedDB`
   * @param request `indexedDB` database opening request
   */
  private createStore(request: IDBOpenDBRequest): void {

    /* Listen to the event fired on first connection */
    fromEvent(request, 'upgradeneeded')
      /* The observable will complete */
      .pipe(first())
      .subscribe(() => {

        /* Check if the store already exists, to avoid error */
        if (!request.result.objectStoreNames.contains(this.storeName)) {

          /* Create the object store */
          request.result.createObjectStore(this.storeName);

        }

      });

  }

  /**
   * Open an `indexedDB` transaction and get our store
   * @param mode `readonly` or `readwrite`
   * @returns An `indexedDB` store, wrapped in an RxJS `Observable`
   */
  private transaction(mode: IDBTransactionMode): Observable<IDBObjectStore> {

    /* From the `indexedDB` connection, open a transaction and get the store */
    return this.database
      .pipe(map((database) => database.transaction([this.storeName], mode).objectStore(this.storeName)));

  }

  // TODO: move fallback in LocalStorage service
  private setFallback(prefix: string | null): void {
    this.fallback = new LocalStorageDatabase(prefix);
  }

  /**
   * Listen to an `indexedDB` success error event
   * @param request Request to listen
   * @returns An RxJS `Observable` listening to the success event
   */
  private successEvent(request: IDBRequest): Observable<Event> {

    return fromEvent(request, 'success');

  }

  /**
   * Listen to an `indexedDB` request error event
   * @param request Request to listen
   * @returns An RxJS `Observable` listening to the error event and if so, throwing an error
   */
  private errorEvent(request: IDBRequest): Observable<never> {

    return fromEvent(request, 'error').pipe(mergeMap(() => throwError(request.error)));

  }

  /**
   * Listen to an `indexedDB` request success and error event, and map to the wanted value
   * @param request Request to listen
   * @param mapCallback Callback returning the wanted value
   * @returns An RxJS `Observable` listening to request events and mapping to the wanted value
   */
  private requestEventsAndMapTo<T>(request: IDBRequest, mapCallback: () => T): Observable<T> {

    /* Listen to the success event and map to the wanted value
     * `mapTo()` must not be used here as it would eval `request.result` too soon */
    const success$ = this.successEvent(request).pipe(map(mapCallback));

    /* Listen to the error event */
    const error$ = this.errorEvent(request);

    /* Choose the first event to occur */
    return race([success$, error$]);

  }

  /**
   * Check if the key exists in the store
   * @param store Objet store on which to perform the request
   * @param key Key to check
   * @returns An `indexedDB` request
   */
  private getKeyRequest(store: IDBObjectStore, key: string): IDBRequest {

    /* `getKey()` is better but only available in `indexedDB` v2 (Chrome >= 58, missing in IE/Edge).
     * In older browsers, the value is checked instead, but it could lead to an exception
     * if `undefined` was stored outside of this lib (e.g. directly with the native `indexedDB` API).
     */
    return ('getKey' in store) ? store.getKey(key) : (store as IDBObjectStore).get(key);

  }

  /**
   * Get all keys from store from a cursor, for older browsers still in `indexedDB` v1
   * @param request Request containing the cursor
   */
  private getKeysFromCursor(request: IDBRequest<IDBCursorWithValue | null>): Observable<string[]> {

    /* Keys will be stored here */
    const keys: string[] = [];

    /* Listen to success event */
    return this.successEvent(request).pipe(
      /* Map to the result */
      map(() => request.result),
      /* Iterate on the cursor */
      tap((cursor) =>  {
        if (cursor) {
          /* Add the key to the list and cast to `string` as the user must not be concerned about specific implementations */
          // TODO: check if all keys can be considered as string
          keys.push(cursor.key as string);
          cursor.continue();
        }
      }),
      /* Wait until the iteration is over */
      filter((cursor) => !cursor),
      /* Map to the retrieved keys */
      map(() => keys)
    );

  }

}
