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
    const b = createGraphics(w, h);
    const metadata = { baseWidth: w, baseHeight: h, alwaysFull, noScale };
    buffers.set(b, metadata);
    return b;
}

function rescaleCanvases(s) {
    for (const [buffer, { baseWidth, baseHeight, alwaysFull, noScale }] of buffers) {
        if (!alwaysFull) {
            const newWidth = Math.floor(baseWidth * s);
            const newHeight = Math.floor(baseHeight * s);
            buffer.resizeCanvas(newWidth, newHeight);
            if (!noScale) buffer.scale(s);
        }
    }
    resizeCanvas(Math.floor(WIDTH * s), Math.floor(HEIGHT * s));
}

function toggleFullscreen() {
    if (document.fullscreenElement === canvas || deviceOrientation === PORTRAIT) document.exitFullscreen();
    else {
        canvas.requestFullscreen().then(function () {
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
    return floor(mouseX / scaler);
}

function getMouseY() {
    return floor(mouseY / scaler);
}

function coordinateInCanvas(x, y, isPixelCoordinate) {
    if (isPixelCoordinate) return x >= 0 && x < width && y >= 0 && y < height;
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
}

function cbrt(n) {   // Cubed root function since p5 doesn't have one nor does pow(n,1/3) work for negative numbers
    return n < 0 ? -pow(abs(n), 1 / 3) : pow(n, 1 / 3);
}

function zeroPad(n, d) {
    const num = parseFloat(n);
    if (!Number.isNaN(num)) {
        const isNegative = num < 0;
        const absNum = Math.abs(num);
        const intPart = Math.floor(absNum).toString();
        const paddedInt = intPart.padStart(d, '0');
        const decimalPart = absNum.toString().includes('.') ? absNum.toString().slice(absNum.toString().indexOf('.')) : '';
        return (isNegative ? '-' : '') + paddedInt + decimalPart;
    }
    return undefined;
}

function hashCode(str) {
    if (!str) return 0;

    let hash = 0;
    const len = str.length;

    let i = 0;
    while (i < len) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i++) | 0;
    }

    return hash;
}

function loadImg(path) {     // wrap p5.loadImage in a promise
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            loadImage(path, resolve, reject);
        });
    });
}

// waitForAsyncProcess allows the simulator to wait for things to load; unneeded for saving
function waitForAsyncProcess(func, desc, ...args) {
    waitingFor++;
    if (waitingFor === 1) {
        waitingTCSymbolSHem = Math.random() < 0.5;
    }

    const descIndex = waitingDescs.lowestAvailable;
    waitingDescs.maxIndex = Math.max(waitingDescs.maxIndex, descIndex);

    waitingDescs.lowestAvailable = descIndex + 1;
    while (waitingDescs[waitingDescs.lowestAvailable]) {
        waitingDescs.lowestAvailable++;
    }

    waitingDescs[descIndex] = desc || "Waiting...";

    const endWait = () => {
        waitingFor--;
        waitingDescs[descIndex] = undefined;
        waitingDescs.lowestAvailable = Math.min(waitingDescs.lowestAvailable, descIndex);

        if (descIndex === waitingDescs.maxIndex) {
            while (waitingDescs.maxIndex >= 0 && !waitingDescs[waitingDescs.maxIndex]) {
                waitingDescs.maxIndex--;
            }
        }
    };

    try {
        const p = func(...args);
        if (p instanceof Promise || p instanceof Dexie.Promise) {
            return p.finally(endWait);
        }
        endWait();
        return Promise.resolve(p);
    } catch (error) {
        endWait();
        return Promise.reject(error);
    }
}

function makeAsyncProcess(func, ...args) {
    return new Promise((resolve, reject) => {
        queueMicrotask(() => {
            try {
                resolve(func(...args));
            } catch (err) {
                reject(err);
            }
        });
    });
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
                for (let i = 0; i < localStorage.length; i++) {
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

document.onfullscreenchange = function () {
    if (document.fullscreenElement === null) {
        scaler = 1;
        rescaleCanvases(scaler);
        if (UI.viewBasin) {
            refreshTracks(true);
            UI.viewBasin.env.displayLayer();
        }
    }
};