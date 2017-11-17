import { Injectable } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import { of as observableOf } from 'rxjs/observable/of';
import { _throw as observableThrow } from 'rxjs/observable/throw';

import { AsyncLocalDatabase } from './async-local-database';

@Injectable()
export class LocalStorageDatabase extends AsyncLocalDatabase {

  /* Initializing native localStorage right now to be able to check its support on class instanciation */
  protected localStorage = localStorage;

  /**
   * Gets an item value in local storage
   * @param key The item's key
   * @returns The item's value if the key exists, null otherwise, wrapped in an RxJS Observable
   */
  public getItem<T = any>(key: string): Observable<T | null> {

    let unparsedData = this.localStorage.getItem(key);
    let parseddata: T | null = null;

    if (unparsedData != null) {

      try {
        parseddata = JSON.parse(unparsedData);
      } catch (error) {
        return observableThrow(new Error(`Invalid data in localStorage.`));
      }

    }

    return observableOf(parseddata);

  }

  /**
   * Sets an item in local storage
   * @param key The item's key
   * @param data The item's value, must NOT be null or undefined
   * @returns An RxJS Observable to wait the end of the operation
   */
  public setItem(key: string, data: any) {

    this.localStorage.setItem(key, JSON.stringify(data));

    return observableOf(true);

  }

  /**
   * Deletes an item in local storage
   * @param key The item's key
   * @returns An RxJS Observable to wait the end of the operation
   */
  public removeItem(key: string) {

    this.localStorage.removeItem(key);

    return observableOf(true);

  }

  /**
   * Deletes all items from local storage
   * @returns An RxJS Observable to wait the end of the operation
   */
  public clear() {

    this.localStorage.clear();

    return observableOf(true);

  }

}
