let paused,
    land,
    // landWorker,
    newBasinSettings,
    waitingFor,
    waitingDescs,
    waitingTCSymbolSHem,
    simSettings,
    textInput,
    buffers,
    scaler,
    tracks,
    stormIcons,
    forecastTracks,
    landBuffer,
    outBasinBuffer,
    landShadows,
    coastLine,
    envLayer,
    magnifyingGlass,
    snow,
    simSpeed,
    lastUpdateTimestamp,
    keyRepeatFrameCounter,
    viewTick,
    selectedStorm,
    renderToDo,
    oldMouseX,
    oldMouseY;

function setup() {
    setVersion(TITLE + " v", VERSION_NUMBER);
    document.title = TITLE;

    setupDatabase();

    createCanvas(WIDTH, HEIGHT);
    defineColors(); // Set the values of COLORS since color() can't be used before setup()
    background(COLORS.bg);
    paused = false;
    newBasinSettings = {};
    waitingFor = 0;
    waitingDescs = {};
    waitingDescs.lowestAvailable = 0;
    waitingDescs.maxIndex = -1;
    waitingTCSymbolSHem = false; // yes seriously, a global var for this
    simSettings = new Settings();

    textInput = document.createElement("input");
    textInput.type = "text";
    document.body.appendChild(textInput);
    textInput.style.position = "absolute";
    textInput.style.left = "-500px";
    textInput.onblur = () => {
        if (UI.focusedInput) UI.focusedInput.value = textInput.value;
        UI.focusedInput = undefined;
    };

    // landWorker = new CSWorker();

let { fullW, fullH } = fullDimensions();
    buffers = new Map();
    scaler = 1;

    const createBufferImage = (w, h) => {
        const buffer = createImage(w, h);
        buffer.loadPixels();
        return buffer;
    }

    tracks = createBuffer();
    tracks.strokeWeight(2);
    stormIcons = createBuffer();
    stormIcons.strokeWeight(3);
    forecastTracks = createBuffer();
    forecastTracks.strokeWeight(2);
    forecastTracks.stroke(240, 240, 0);
    forecastTracks.noFill();
    landBuffer = createBufferImage(fullW, fullH);
    outBasinBuffer = createBufferImage(fullW, fullH);
    landShadows = createBufferImage(fullW, fullH);
    coastLine = createBufferImage(fullW, fullH);
        envLayer = createBuffer(WIDTH, HEIGHT, false, true);
    envLayer.colorMode(HSB);
    envLayer.strokeWeight(2);
    envLayer.noStroke();
    magnifyingGlass = createBuffer(ENV_LAYER_TILE_SIZE * 4, ENV_LAYER_TILE_SIZE * 4, false, true);
    magnifyingGlass.colorMode(HSB);
    magnifyingGlass.strokeWeight(2);
    magnifyingGlass.noStroke();
    snow = [];
    for (let i = 0; i < MAX_SNOW_LAYERS; i++) {
        snow[i] = createBufferImage(fullW, fullH);
            }

    simSpeed = 0; // The exponent for the simulation speed (0 is full-speed, 1 is half-speed, etc.)
    lastUpdateTimestamp = performance.now(); // Keeps track of how much time has passed since the last simulation step to control the simulation at varying speeds
    keyRepeatFrameCounter = 0;

    upgradeLegacySaves();
    UI.init();
}

function draw() {
    try {
        scale(scaler);
        background(COLORS.bg);
        if (waitingFor < 1) {   // waitingFor applies to asynchronous processes such as saving and loading
            if (UI.viewBasin instanceof Basin) {
                if (renderToDo) {     // renderToDo applies to synchronous single-threaded rendering functions
                    let t = renderToDo.next();
                    if (t.done) {
                        renderToDo = undefined;
                        return;
                    }
                    push();
                    textSize(48);
                    textAlign(CENTER, CENTER);
                    text(t.value, WIDTH / 2, HEIGHT / 2);
                    pop();
                    return;
                }
                stormIcons.clear();
                if (!paused) {
                    const step = STEP / Math.pow(2, simSpeed);
                    let delta = Math.floor((performance.now() - lastUpdateTimestamp) / step);
                    UI.viewBasin.advanceSim(delta);
                    lastUpdateTimestamp += delta * step;
                }
                keyRepeatFrameCounter++;
                if (keyIsPressed && document.activeElement !== textInput && (keyRepeatFrameCounter >= KEY_REPEAT_COOLDOWN || keyRepeatFrameCounter === 0) && keyRepeatFrameCounter % KEY_REPEATER === 0) {
                    if (paused && primaryWrapper.showing) {
                        if (keyCode === LEFT_ARROW && viewTick >= ADVISORY_TICKS) {
                            changeViewTick(Math.ceil(viewTick / ADVISORY_TICKS - 1) * ADVISORY_TICKS);
                        } else if (keyCode === RIGHT_ARROW) {
                            let t;
                            if (viewTick < UI.viewBasin.tick - ADVISORY_TICKS) t = Math.floor(viewTick / ADVISORY_TICKS + 1) * ADVISORY_TICKS;
                            else t = UI.viewBasin.tick;
                            changeViewTick(t);
                        }
                    }
                }
                if ((mouseX !== oldMouseX || mouseY !== oldMouseY) && simSettings.showMagGlass) UI.viewBasin.env.updateMagGlass();
            }

            UI.updateMouseOver();
            UI.renderAll();
        } else {
            let d = 100;
            push();
            translate(WIDTH / 2, HEIGHT / 2);
            push();
            noStroke();
            fill(COLORS.UI.loadingSymbol);
            ellipse(0, 0, d);
            if (waitingTCSymbolSHem) scale(1, -1);
            rotate(millis() * -PI / 500);
            beginShape();
            vertex(d * 5 / 8, -d);
            bezierVertex(d * 5 / 8, -d, -d * 1 / 2, -d * 7 / 8, -d * 1 / 2, 0);
            vertex(0, 0);
            bezierVertex(-d * 1 / 4, -d * 5 / 8, d * 5 / 8, -d, d * 5 / 8, -d);
            endShape();
            rotate(PI);
            beginShape();
            vertex(d * 5 / 8, -d);
            bezierVertex(d * 5 / 8, -d, -d * 1 / 2, -d * 7 / 8, -d * 1 / 2, 0);
            vertex(0, 0);
            bezierVertex(-d * 1 / 4, -d * 5 / 8, d * 5 / 8, -d, d * 5 / 8, -d);
            endShape();
            pop();
            textSize(48);
            textAlign(CENTER, CENTER);
            let desc = '';
            for (let i = 0; i <= waitingDescs.maxIndex; i++) {
                if (waitingDescs[i]) {
                    if (desc !== '')
                        desc += '\n';
                    desc += waitingDescs[i];
                }
            }
            text(desc, 0, 0);
            pop();
        }
        oldMouseX = mouseX;
        oldMouseY = mouseY;
    } catch (err) {            // BSOD
        resetMatrix();
        colorMode(RGB);
        background(20, 0, 178);
        fill(255);
        textSize(24);
        textAlign(LEFT, TOP);
        text("Zoinks! Something went wrong.", width / 16, height / 8);
        textSize(15);
        text(err.stack, width / 16, height / 4);
        console.error(err);
        noLoop();
    }
}

class Settings {
    constructor() {
        const order = Settings.order();
        const defaults = Settings.defaults();
        waitForAsyncProcess(() => {
            return db.settings.get(DB_KEY_SETTINGS);
        }, 'Retrieving settings...').catch(err => {
            console.error(err);
        }).then(result => {
            let v = result;
            if (!v) {
                let lsKey = LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SETTINGS;
                v = localStorage.getItem(lsKey);
                if (v) {
                    v = decodeB36StringArray(v);
                    db.settings.put(v, DB_KEY_SETTINGS)
                        .catch(err => {
                        console.error(err);
})
                        .then(() => {
                            localStorage.removeItem(lsKey);
                    });
                } else {
                    v = [];
            }
            }
            order.forEach((key, i) => {
                this[key] = v.length > 0 ? v.pop() : defaults[i];
            });
            order.forEach(key => {
                    this[`set${key.charAt(0).toUpperCase()}${key.slice(1)}`] = (v, v2) => {
                this.set(key, v, v2);
            };
            });
        });
    }

    static order() {
        return ["colorScheme", "speedUnit", "smoothLandColor", "showMagGlass", "snowLayers", "useShadows", "trackMode", "showStrength", "doAutosave"];    // add new settings to the beginning of this array
    }

    static defaults() {
        return [0, 0, true, false, 2, false, 0, false, true];  // add new defaults to the beginning of this array
    }

    save() {
        const order = Settings.order();
        let v = Object.keys(this).filter(key => order.has(key)).map(key => this[key]);
                db.settings.put(v, DB_KEY_SETTINGS).catch(err => {
            console.error(err);
        });
    }

    set(k, v, v2) {
        if (v === 'toggle') {
            this[k] = !this[k];
        } else if (v === 'incmod') {
            this[k] = (this[k] + 1) % v2;
        } else {
            Object.assign(this, { [k]: v });
        }
        this.save();
    }

    get(k) {         // accessing the property directly also works (only for getting)
        return this[k];
    }
}
