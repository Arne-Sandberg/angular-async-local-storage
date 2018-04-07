# Async local storage for Angular

Efficient local storage module for Angular apps and Progressive Wep apps (PWA):
- **simplicity**: based on native `localStorage` API and automatic JSON stringify/parse,
- **perfomance**: internally stored via the asynchronous `IndexedDB` API,
- **Angular-like**: wrapped in RxJS `Observables`,
- **security**: validate data with a JSON Schema,
- **extensibility**: add your own storage.

You could also be interested by [@ngx-pwa/offline](https://github.com/cyrilletuzi/ngx-pwa-offline).

## Angular onsite training

The author of this library organizes Angular courses (based in Paris, France, but open to travel). You can find [my bio here](https://www.cyrilletuzi.com/en/web/) (in English) and [course details here](https://formationjavascript.com/formation-angular/) (in French).

## Why this module?

For now, Angular does not provide a local storage module, and almost every app needs some local storage. 
There are 2 native JavaScript APIs available:
- [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

The `localStorage` API is simple to use but synchronous, so if you use it too often, 
your app will soon begin to freeze.

The `IndexedDB` API is asynchronous and efficient, but it's a mess to use: 
you'll soon be caught by the callback hell, as it does not support Promises yet.

Mozilla has done a very great job with the [localForage library](http://localforage.github.io/localForage/) : 
a simple API based on native `localStorage`,
but internally stored via the asynchronous `IndexedDB` for performance.
But it's built in ES5 old school way and then it's a mess to include into Angular.

This module is based on the same idea as localForage, but in ES6/ES2015 
and additionally wrapped into [RxJS Observables](http://reactivex.io/rxjs/) 
to be homogeneous with other Angular modules.

## Migration from angular-async-local-storage

If you already use the previous `angular-async-local-storage` package, see the [migration guide](https://github.com/cyrilletuzi/angular-async-local-storage/blob/master/MIGRATION.md).

## Getting started

Install the same version as your Angular one via [npm](http://npmjs.com):

```bash
# For Angular 5 (latest):
npm install @ngx-pwa/local-storage

# For Angular 4 (and TypeScript >= 2.3):
npm install @ngx-pwa/local-storage@4
```

Then include the `LocalStorage` module in your app root module (just once, do NOT re-import it in your submodules).

```typescript
import { LocalStorageModule } from '@ngx-pwa/local-storage';

@NgModule({
  imports: [
    BrowserModule,
    LocalStorageModule,
    ...
  ]
  ...
})
export class AppModule {}
```

Now you just have to inject the service where you need it:

```typescript
import { LocalStorage } from '@ngx-pwa/local-storage';

@Injectable()
export class YourService {

  constructor(protected localStorage: LocalStorage) {}

}
```

## API

The API follows the [native localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage), 
except it's asynchronous via [RxJS Observables](http://reactivex.io/rxjs/).

### Writing data

```typescript
let user: User = { firstName: 'Henri', lastName: 'Bergson' };

this.localStorage.setItem('user', user).subscribe(() => {});
```

You can store any value, without worrying about stringifying.

### Deleting data

To delete one item:

```typescript
this.localStorage.removeItem('user').subscribe(() => {});
```

To delete all items:

```typescript
this.localStorage.clear().subscribe(() => {});
```

### Reading data

```typescript
this.localStorage.getItem<User>('user').subscribe((user) => {
  user.firstName; // should be 'Henri'
});
```

As any data can be stored, you can type your data.

Don't forget it's client-side storage: **always check the data**, as it could have been forged or deleted.

### Notes

- Not finding an item is not an error, it succeeds but returns `null`.

```typescript
this.localStorage.getItem('notexisting').subscribe((data) => {
  data; // null
});
```

- Errors are unlikely to happen, but in an app, it's better to catch any potential error.

```typescript
this.localStorage.setItem('color', 'red').subscribe(() => {
  // Done
}, () => {
  // Error
});
```

- You *DO* need to subscribe, even if you don't have something specific to do after writing in local storage (because it's how RxJS Observables work).

- You do *NOT* need to unsubscribe: the observable autocompletes (like in the `HttpClient` service).

- When reading data, you'll only get one value: the observable is here for asynchronicity but is not meant to
emit again when the stored data is changed. And it's normal: if app data change, it's the role of your app
to keep track of it, not of this lib. See [#16](https://github.com/cyrilletuzi/angular-async-local-storage/issues/16) 
for more context and [#4](https://github.com/cyrilletuzi/angular-async-local-storage/issues/4)
for an example. 

## Angular support

This lib major version is aligned to the major version of Angular. Meaning for Angular 4 you need version 4,
for Angular 5 you need version 5, and so on.

We follow [Angular LTS support](https://github.com/angular/angular/blob/master/docs/RELEASE_SCHEDULE.md),
meaning we support Angular 4 minimum, until October 2018.

This module supports [AoT pre-compiling](https://angular.io/guide/aot-compiler).

This module supports [Universal server-side rendering](https://github.com/angular/universal)
via a mock storage.

## Browser support

[All browsers supporting IndexedDB](http://caniuse.com/#feat=indexeddb), ie. **all current browsers** :
Firefox, Chrome, Opera, Safari, Edge, and IE10+.

Local storage is required only for apps, and given that you won't do an app in older browsers,
current browsers support is far enough.

Even so, IE9 is supported but use native localStorage as a fallback, 
so internal operations are synchronous (the public API remains asynchronous-like).

This module is not impacted by IE/Edge missing IndexedDB features.

It also works in tools based on browser engines (like Electron) but not in non-browser tools (like NativeScript, see
[#11](https://github.com/cyrilletuzi/angular-async-local-storage/issues/11)).

### Private mode

Be aware that local storage is limited in browsers when in private / incognito modes. Most browsers will delete the data when the private browsing session ends. 
It's not a real issue as local storage is useful for apps, and apps should not be in private mode.

In IE / Edge, `indexedDB`  is `null` when in private mode. The lib fallbacks to (synchronous) `localStorage`.

In Firefox, `indexedDB` API is available in code but throwing error on usage. It's a bug in the browser, this lib can't handle it, see
[#26](https://github.com/cyrilletuzi/angular-async-local-storage/issues/26).

## Changelog

[Changelog available here](https://github.com/cyrilletuzi/angular-async-local-storage/blob/master/CHANGELOG.md).

## License

MIT
