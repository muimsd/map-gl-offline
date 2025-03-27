'use strict';

const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

let idbProxyableTypes;
let cursorAdvanceMethods;
// This is a function to prevent it throwing up in node environments.
function getIdbProxyableTypes() {
    return (idbProxyableTypes ||
        (idbProxyableTypes = [
            IDBDatabase,
            IDBObjectStore,
            IDBIndex,
            IDBCursor,
            IDBTransaction,
        ]));
}
// This is a function to prevent it throwing up in node environments.
function getCursorAdvanceMethods() {
    return (cursorAdvanceMethods ||
        (cursorAdvanceMethods = [
            IDBCursor.prototype.advance,
            IDBCursor.prototype.continue,
            IDBCursor.prototype.continuePrimaryKey,
        ]));
}
const transactionDoneMap = new WeakMap();
const transformCache = new WeakMap();
const reverseTransformCache = new WeakMap();
function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
        const unlisten = () => {
            request.removeEventListener('success', success);
            request.removeEventListener('error', error);
        };
        const success = () => {
            resolve(wrap(request.result));
            unlisten();
        };
        const error = () => {
            reject(request.error);
            unlisten();
        };
        request.addEventListener('success', success);
        request.addEventListener('error', error);
    });
    // This mapping exists in reverseTransformCache but doesn't exist in transformCache. This
    // is because we create many promises from a single IDBRequest.
    reverseTransformCache.set(promise, request);
    return promise;
}
function cacheDonePromiseForTransaction(tx) {
    // Early bail if we've already created a done promise for this transaction.
    if (transactionDoneMap.has(tx))
        return;
    const done = new Promise((resolve, reject) => {
        const unlisten = () => {
            tx.removeEventListener('complete', complete);
            tx.removeEventListener('error', error);
            tx.removeEventListener('abort', error);
        };
        const complete = () => {
            resolve();
            unlisten();
        };
        const error = () => {
            reject(tx.error || new DOMException('AbortError', 'AbortError'));
            unlisten();
        };
        tx.addEventListener('complete', complete);
        tx.addEventListener('error', error);
        tx.addEventListener('abort', error);
    });
    // Cache it for later retrieval.
    transactionDoneMap.set(tx, done);
}
let idbProxyTraps = {
    get(target, prop, receiver) {
        if (target instanceof IDBTransaction) {
            // Special handling for transaction.done.
            if (prop === 'done')
                return transactionDoneMap.get(target);
            // Make tx.store return the only store in the transaction, or undefined if there are many.
            if (prop === 'store') {
                return receiver.objectStoreNames[1]
                    ? undefined
                    : receiver.objectStore(receiver.objectStoreNames[0]);
            }
        }
        // Else transform whatever we get back.
        return wrap(target[prop]);
    },
    set(target, prop, value) {
        target[prop] = value;
        return true;
    },
    has(target, prop) {
        if (target instanceof IDBTransaction &&
            (prop === 'done' || prop === 'store')) {
            return true;
        }
        return prop in target;
    },
};
function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
}
function wrapFunction(func) {
    // Due to expected object equality (which is enforced by the caching in `wrap`), we
    // only create one new func per func.
    // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
    // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
    // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
    // with real promises, so each advance methods returns a new promise for the cursor object, or
    // undefined if the end of the cursor has been reached.
    if (getCursorAdvanceMethods().includes(func)) {
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            func.apply(unwrap(this), args);
            return wrap(this.request);
        };
    }
    return function (...args) {
        // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
        // the original object.
        return wrap(func.apply(unwrap(this), args));
    };
}
function transformCachableValue(value) {
    if (typeof value === 'function')
        return wrapFunction(value);
    // This doesn't return, it just creates a 'done' promise for the transaction,
    // which is later returned for transaction.done (see idbObjectHandler).
    if (value instanceof IDBTransaction)
        cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
        return new Proxy(value, idbProxyTraps);
    // Return the same value back if we're not going to transform it.
    return value;
}
function wrap(value) {
    // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
    // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
    if (value instanceof IDBRequest)
        return promisifyRequest(value);
    // If we've already transformed this value before, reuse the transformed value.
    // This is faster, but it also provides object equality.
    if (transformCache.has(value))
        return transformCache.get(value);
    const newValue = transformCachableValue(value);
    // Not all types are transformed.
    // These may be primitive types, so they can't be WeakMap keys.
    if (newValue !== value) {
        transformCache.set(value, newValue);
        reverseTransformCache.set(newValue, value);
    }
    return newValue;
}
const unwrap = (value) => reverseTransformCache.get(value);

/**
 * Open a database.
 *
 * @param name Name of the database.
 * @param version Schema version.
 * @param callbacks Additional callbacks.
 */
function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);
    if (upgrade) {
        request.addEventListener('upgradeneeded', (event) => {
            upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
        });
    }
    if (blocked) {
        request.addEventListener('blocked', (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion, event.newVersion, event));
    }
    openPromise
        .then((db) => {
        if (terminated)
            db.addEventListener('close', () => terminated());
        if (blocking) {
            db.addEventListener('versionchange', (event) => blocking(event.oldVersion, event.newVersion, event));
        }
    })
        .catch(() => { });
    return openPromise;
}

const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
const writeMethods = ['put', 'add', 'delete', 'clear'];
const cachedMethods = new Map();
function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase &&
        !(prop in target) &&
        typeof prop === 'string')) {
        return;
    }
    if (cachedMethods.get(prop))
        return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, '');
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
        !(isWrite || readMethods.includes(targetFuncName))) {
        return;
    }
    const method = async function (storeName, ...args) {
        // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
        const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
        let target = tx.store;
        if (useIndex)
            target = target.index(args.shift());
        // Must reject if op rejects.
        // If it's a write operation, must reject if tx.done rejects.
        // Must reject with op rejection first.
        // Must resolve with op value.
        // Must handle both promises (no unhandled rejections)
        return (await Promise.all([
            target[targetFuncName](...args),
            isWrite && tx.done,
        ]))[0];
    };
    cachedMethods.set(prop, method);
    return method;
}
replaceTraps((oldTraps) => ({
    ...oldTraps,
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
}));

const advanceMethodProps = ['continue', 'continuePrimaryKey', 'advance'];
const methodMap = {};
const advanceResults = new WeakMap();
const ittrProxiedCursorToOriginalProxy = new WeakMap();
const cursorIteratorTraps = {
    get(target, prop) {
        if (!advanceMethodProps.includes(prop))
            return target[prop];
        let cachedFunc = methodMap[prop];
        if (!cachedFunc) {
            cachedFunc = methodMap[prop] = function (...args) {
                advanceResults.set(this, ittrProxiedCursorToOriginalProxy.get(this)[prop](...args));
            };
        }
        return cachedFunc;
    },
};
async function* iterate(...args) {
    // tslint:disable-next-line:no-this-assignment
    let cursor = this;
    if (!(cursor instanceof IDBCursor)) {
        cursor = await cursor.openCursor(...args);
    }
    if (!cursor)
        return;
    cursor = cursor;
    const proxiedCursor = new Proxy(cursor, cursorIteratorTraps);
    ittrProxiedCursorToOriginalProxy.set(proxiedCursor, cursor);
    // Map this double-proxy back to the original, so other cursor methods work.
    reverseTransformCache.set(proxiedCursor, unwrap(cursor));
    while (cursor) {
        yield proxiedCursor;
        // If one of the advancing methods was not called, call continue().
        cursor = await (advanceResults.get(proxiedCursor) || cursor.continue());
        advanceResults.delete(proxiedCursor);
    }
}
function isIteratorProp(target, prop) {
    return ((prop === Symbol.asyncIterator &&
        instanceOfAny(target, [IDBIndex, IDBObjectStore, IDBCursor])) ||
        (prop === 'iterate' && instanceOfAny(target, [IDBIndex, IDBObjectStore])));
}
replaceTraps((oldTraps) => ({
    ...oldTraps,
    get(target, prop, receiver) {
        if (isIteratorProp(target, prop))
            return iterate;
        return oldTraps.get(target, prop, receiver);
    },
    has(target, prop) {
        return isIteratorProp(target, prop) || oldTraps.has(target, prop);
    },
}));

const dbPromise = openDB('offline-map-db', 1, {
    upgrade(db) {
        db.createObjectStore('regions', { keyPath: 'id' });
        db.createObjectStore('tiles', { keyPath: 'key' });
        db.createObjectStore('sprites', { keyPath: 'key' });
        db.createObjectStore('styles', { keyPath: 'key' });
        db.createObjectStore('fonts', { keyPath: 'key' });
    },
});

const d2r = Math.PI / 180;
/**
 * Get the tile for a point at a specified zoom level
 *
 * const tile = pointToTile(1, 1, 20)
 * //=tile
 */
function pointToTile(lon, lat, z) {
    const tile = pointToTileFraction(lon, lat, z);
    tile[0] = Math.floor(tile[0]);
    tile[1] = Math.floor(tile[1]);
    return tile;
}
/**
 * Get the precise fractional tile location for a point at a zoom level
 *
 * const tile = pointToTileFraction(30.5, 50.5, 15)
 * //=tile
 */
function pointToTileFraction(lon, lat, z) {
    const sin = Math.sin(lat * d2r);
    const z2 = Math.pow(2, z);
    let x = z2 * (lon / 360 + 0.5);
    const y = z2 * (0.5 - (0.25 * Math.log((1 + sin) / (1 - sin))) / Math.PI);
    // Wrap Tile X
    x = x % z2;
    if (x < 0)
        x = x + z2;
    return [x, y, z];
}

async function loadTiles(region) {
    const db = await dbPromise;
    const { bounds, minZoom, maxZoom } = region;
    // Generate tile URLs based on the region bounds and zoom levels
    const tileUrls = generateTileUrls(bounds, minZoom, maxZoom);
    for (const url of tileUrls) {
        const tileData = await db.get('tiles', url);
        if (tileData) {
            // Logic to add tile data to the map
            console.log(`Loaded tile from ${url}`);
        }
    }
}
function generateTileUrls(bounds, minZoom, maxZoom) {
    const urls = [];
    const [sw, ne] = bounds;
    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
        const swTile = pointToTile(sw[0], sw[1], zoom);
        const neTile = pointToTile(ne[0], ne[1], zoom);
        for (let x = swTile[0]; x <= neTile[0]; x++) {
            for (let y = swTile[1]; y <= neTile[1]; y++) {
                const tileUrl = `https://example.com/tiles/${zoom}/${x}/${y}.png`; // Replace with actual tile URL template
                urls.push(tileUrl);
            }
        }
    }
    return urls;
}

async function loadSprites() {
    // Logic to load sprites from storage
}

async function downloadStyles(stylesUrl) {
    try {
        const response = await fetch(stylesUrl);
        if (!response.ok) {
            throw new Error('Failed to download styles');
        }
        const styles = await response.json();
        const db = await dbPromise;
        const tx = db.transaction('styles', 'readwrite');
        const store = tx.objectStore('styles');
        const storedStyleIds = [];
        for (const style of styles) {
            const styleWithId = { ...style, id: style.id || crypto.randomUUID() }; // Ensure each style has an ID
            await store.put(styleWithId);
            storedStyleIds.push(styleWithId.id); // Collect the ID of the stored style
        }
        await tx.oncomplete;
        console.log('Styles downloaded and stored successfully');
        return storedStyleIds; // Return the IDs of the stored styles
    }
    catch (error) {
        console.error('Error downloading styles:', error);
        return [];
    }
}

class OfflineMapManager {
    // private map: mapboxgl.Map | maplibregl.Map;
    // constructor(map: mapboxgl.Map | maplibregl.Map) {
    //   this.map = map;
    // }
    constructor() { }
    async addRegion(region) {
        await dbPromise;
        console.log('Adding region:', region);
        if (region.multipleRegions) {
            // Option 1: Save region by style URL
            console.log(`Saving region by style URL: ${region.styleUrl}`);
            const styleID = await downloadStyles(region.styleUrl);
            console.log(`Style ID: ${styleID}`);
            // await db.put('regions', region);
            // await downloadTiles(region);
            // await downloadSprites();
            // const fontUrls = generateFontUrls(region.styleUrl!); // Pass style URL to generate font URLs
            // await downloadFonts(fontUrls);
        }
        else {
            // Option 2: Save region differently (e.g., by custom identifier)
            console.log(`Saving region by custom identifier: ${region.id}`);
            // await db.put('regions', region);
            // await downloadTiles(region);
            // await downloadSprites();
            // await downloadStyles(region.styleUrl!);
            // const fontUrls = generateFontUrls(region.styleUrl!); // Generate font URLs without style URL
            // await downloadFonts(fontUrls);
        }
    }
    async loadRegion(region) {
        const db = await dbPromise;
        const currentRegion = await db.get('regions', region.id);
        if (currentRegion) {
            await loadTiles(currentRegion);
            await loadSprites();
            // if (region.styleUrl) {
            //   await loadStyles(region.styleUrl!);
            //   const fontUrls = generateFontUrls(region.styleUrl);
            //   await loadFonts(fontUrls);
            // } else {
            //   await loadStyles();
            //   const fontUrls = generateFontUrls();
            //   await loadFonts(fontUrls);
            // }
        }
    }
    async listRegions() {
        const db = await dbPromise;
        return await db.getAll('regions');
    }
    async deleteRegion(regionId) {
        const db = await dbPromise;
        await db.delete('regions', regionId);
        // Add logic to delete tiles, sprites, styles, and fonts if necessary
    }
}

async function main() {
    try {
        const manager = new OfflineMapManager();
        await manager.addRegion({
            id: 'world',
            name: 'World',
            multipleRegions: true,
            styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            bounds: [
                [-180, -85],
                [180, 85],
            ],
            minZoom: 0,
            maxZoom: 6,
        });
    }
    catch (error) {
        console.error('Error in main:', error);
    }
}
main();
//# sourceMappingURL=bundle.js.map
