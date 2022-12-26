function refreshTracks(force) {
    if (simSettings.trackMode === 2 && !force) return;
    tracks.clear();
    forecastTracks.clear();
    if (selectedStorm) selectedStorm.renderTrack();
    else if (simSettings.trackMode === 2) {
        let target = UI.viewBasin.getSeason(viewTick);
        let valid = sys => (sys.inBasinTC && (UI.viewBasin.getSeason(sys.enterTime) === target || UI.viewBasin.getSeason(sys.enterTime) < target && (sys.exitTime === undefined || UI.viewBasin.getSeason(sys.exitTime - 1) >= target)));
        for (let s of UI.viewBasin.fetchSeason(viewTick, true, true).forSystems()) if (valid(s)) s.renderTrack();
    } else if (UI.viewBasin.viewingPresent()) for (let s of UI.viewBasin.activeSystems) s.fetchStorm().renderTrack();
    else for (let s of UI.viewBasin.fetchSeason(viewTick, true, true).forSystems()) s.renderTrack();
}

function createBuffer(w = WIDTH, h = HEIGHT, alwaysFull = false, noScale = false) {
    let b = createGraphics(w, h);
    let metadata = { w, h, alwaysFull, noScale };
    buffers.set(b, metadata);
    return b;
}

function rescaleCanvases(s) {
    buffers.forEach(([buffer, metadata]) => {
        if (!metadata.alwaysFull) {
            buffer.resizeCanvas(Math.floor(metadata.baseWidth * s), Math.floor(metadata.baseHeight * s));
            if (!metadata.noScale) buffer.scale(s);
        }
    });
    resizeCanvas(Math.floor(WIDTH * s), Math.floor(HEIGHT * s));
}

function toggleFullscreen() {
    if (document.fullscreenElement === canvas || deviceOrientation === PORTRAIT) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen().then(() => {
            scaler = displayWidth / WIDTH;
            rescaleCanvases(scaler);
            if (UI.viewBasin) {
                refreshTracks(true);
                UI.viewBasin.env.displayLayer();
            }
        });
    }
}

function fullDimensions() {
    let fullW = deviceOrientation === PORTRAIT ? displayHeight : displayWidth;
    let fullH = fullW * HEIGHT / WIDTH;
    return { fullW, fullH };
}

function drawBuffer(b) {
    image(b, 0, 0, WIDTH, HEIGHT);
}

function getMouseX() {
    return Math.floor(mouseX / scaler);
}

function getMouseY() {
    return Math.floor(mouseY / scaler);
}

function coordinateInCanvas(x, y, isPixelCoordinate) {
    const maxX = isPixelCoordinate ? width : WIDTH;
    const maxY = isPixelCoordinate ? height : HEIGHT;
    return x >= 0 && x < maxX && y >= 0 && y < maxY;
}

function cbrt(n) {  // Cubed root function since p5 doesn't have one nor does pow(n,1/3) work for negative numbers
    return n < 0 ? -Math.pow(Math.abs(n), 1 / 3) : Math.pow(n, 1 / 3);
}

function zeroPad(n, d) {
    n = parseFloat(n);
    if (!Number.isNaN(n)) {
        const int = Math.trunc(n);
        let str = Math.abs(int).toString().padStart(d, '0');
        if (int < 0) {
            str = `-${str}`;
        }
        const fraction = Math.abs(n) - Math.abs(int);
        if (fraction > 0) {
            str += fraction.toString().slice(1);
        }
        return str;
    }
}

function hashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash &= hash; // Convert to 32bit integer
    }
    return hash;
}

function loadImg(path) {     // wrap p5.loadImage in a promise
    return new Promise((resolve, reject) => {
        loadImage(path, resolve, reject);
    });
}

// waitForAsyncProcess allows the simulator to wait for things to load; unneeded for saving
function waitForAsyncProcess(func, desc, ...args) {  // add .then() callbacks inside of func before returning the promise, but add .catch() to the returned promise of waitForAsyncProcess
    waitingFor++;
    if (waitingFor < 2) {
        waitingTCSymbolSHem = Math.random() < 0.5;
    }
    let descIndex = waitingDescs.lowestAvailable;
    if (descIndex > waitingDescs.maxIndex) {
        waitingDescs.maxIndex = descIndex;
    }
    for (let i = descIndex + 1; i <= waitingDescs.maxIndex + 1; i++) {
        if (!waitingDescs[i]) {
            waitingDescs.lowestAvailable = i;
            break;
        }
    }
    waitingDescs[descIndex] = desc;
    let endWait = () => {
        waitingFor--;
        waitingDescs[descIndex] = undefined;
        if (descIndex < waitingDescs.lowestAvailable)
            waitingDescs.lowestAvailable = descIndex;
        if (descIndex >= waitingDescs.maxIndex) {
            for (let i = descIndex; i >= -1; i--) {
                if (i < 0 || waitingDescs[i]) {
                    waitingDescs.maxIndex = i;
                    break;
                }
            }
        }
    };
    let p = func(...args);
    if (p instanceof Promise || p instanceof Dexie.Promise) {
        return p.finally(() => endWait());
    }
    endWait();
    return Promise.resolve(p);
}

async function makeAsyncProcess(func, ...args) {
    return await setTimeout(() => func(...args), 0);
}

function upgradeLegacySaves() {
    return waitForAsyncProcess(() => {
        return makeAsyncProcess(() => {
            // Rename saved basin keys for save slot 0 from versions v20190217a and prior

            let oldPrefix = LOCALSTORAGE_KEY_PREFIX + '0-';
            let newPrefix = LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SAVEDBASIN + '0-';
            let f = LOCALSTORAGE_KEY_FORMAT;
            let b = LOCALSTORAGE_KEY_BASIN;
            let n = LOCALSTORAGE_KEY_NAMES;
            if (localStorage.getItem(oldPrefix + f)) {
                localStorage.setItem(newPrefix + f, localStorage.getItem(oldPrefix + f));
                localStorage.removeItem(oldPrefix + f);
                localStorage.setItem(newPrefix + b, localStorage.getItem(oldPrefix + b));
                localStorage.removeItem(oldPrefix + b);
                localStorage.setItem(newPrefix + n, localStorage.getItem(oldPrefix + n));
                localStorage.removeItem(oldPrefix + n);
            }
        }).then(() => {
            // Transfer localStorage saves to indexedDB

            return db.transaction('rw', db.saves, db.seasons, () => {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    let k = localStorage.key(i);
                    if (k.startsWith(LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SAVEDBASIN)) {
                        let s = k.slice((LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SAVEDBASIN).length);
                        s = s.split('-');
                        let name = parseInt(s[0]);
                        if (name === 0) name = AUTOSAVE_SAVE_NAME;
                        else name = LEGACY_SAVE_NAME_PREFIX + name;
                        let pre = LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SAVEDBASIN + s[0] + '-';
                        if (s[1] === LOCALSTORAGE_KEY_FORMAT) {
                            let obj = {};
                            obj.format = parseInt(localStorage.getItem(k), SAVING_RADIX);
                            obj.value = {};
                            obj.value.str = localStorage.getItem(pre + LOCALSTORAGE_KEY_BASIN);
                            obj.value.names = localStorage.getItem(pre + LOCALSTORAGE_KEY_NAMES);
                            db.saves.where(':id').equals(name).count().then(c => {
                                if (c < 1) db.saves.put(obj, name);
                            });
                        } else if (s[1] + '-' === LOCALSTORAGE_KEY_SEASON) {
                            let y;
                            if (s[2] === '') y = -parseInt(s[3]);
                            else y = parseInt(s[2]);
                            let obj = {};
                            obj.format = FORMAT_WITH_SAVED_SEASONS;
                            obj.saveName = name;
                            obj.season = y;
                            obj.value = localStorage.getItem(k);
                            db.seasons.where('[saveName+season]').equals([name, y]).count().then(c => {
                                if (c < 1) db.seasons.put(obj);
                            });
                        }
                    }
                }
            }).then(() => {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    let k = localStorage.key(i);
                    if (k.startsWith(LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SAVEDBASIN)) localStorage.removeItem(k);
                }
            });
        });
    }, 'Upgrading...').catch(e => {
        console.error(e);
    });
}

document.onfullscreenchange = () => {
    document.fullscreenElement === null ? rescaleCanvases(1) : undefined;
    if (UI.viewBasin) {
        refreshTracks(true);
        UI.viewBasin.env.displayLayer();
    }
};