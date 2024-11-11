var paused,
    land,
    // landWorker,
    waitingFor,
    waitingDescs,
    waitingTCSymbolSHem,
    simSettings,
    // textInput,
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
    oldMouseY,
    seasonCurve;

function setup() {
    setVersion(TITLE + " v", VERSION_NUMBER);
    document.title = TITLE;

    setupDatabase();

    createCanvas(WIDTH, HEIGHT);
    defineColors(); // Set the values of COLORS since color() can't be used before setup()
    background(COLORS.bg);
    paused = false;
    waitingFor = 0;
    waitingDescs = {};
    waitingDescs.lowestAvailable = 0;
    waitingDescs.maxIndex = -1;
    waitingTCSymbolSHem = false; // yes seriously, a global var for this
    simSettings = new Settings();

    textFont("Arial");
    // textInput = document.createElement("input");
    // textInput.type = "text";
    // document.body.appendChild(textInput);
    // textInput.style.position = "absolute";
    // textInput.style.left = "-500px";
    // textInput.onblur = ()=>{
    //     if(UI.focusedInput) UI.focusedInput.value = textInput.value;
    //     UI.focusedInput = undefined;
    // };

    // landWorker = new CSWorker();

    buffers = new Map();
    scaler = 1;

    let { fullW, fullH } = fullDimensions();
    tracks = createBuffer();
    tracks.strokeWeight(2);
    stormIcons = createBuffer();
    stormIcons.strokeWeight(3);
    forecastTracks = createBuffer();
    // forecastTracks.strokeWeight(2);
    // forecastTracks.stroke(240,240,0);
    // forecastTracks.noFill();
    forecastTracks.noStroke();
    forecastTracks.fill(255);
    landBuffer = createImage(fullW, fullH);
    landBuffer.loadPixels();
    // landBuffer.noStroke();
    outBasinBuffer = createImage(fullW, fullH);
    outBasinBuffer.loadPixels();
    // outBasinBuffer.noStroke();
    // outBasinBuffer.fill(COLORS.outBasin);
    landShadows = createImage(fullW, fullH);
    landShadows.loadPixels();
    // landShadows.noStroke();
    coastLine = createImage(fullW, fullH);
    coastLine.loadPixels();
    // coastLine.fill(0);
    // coastLine.noStroke();
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
        snow[i] = createImage(fullW, fullH);
        snow[i].loadPixels();
        // snow[i].noStroke();
        // snow[i].fill(COLORS.snow);
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
                if ((mouseX !== oldMouseX || mouseY !== oldMouseY) && simSettings.showMagGlass) UI.viewBasin.env.updateMagGlass();
            }

            keyRepeatFrameCounter++;
            if (keyIsPressed /* && document.activeElement!==textInput */ && (keyRepeatFrameCounter >= KEY_REPEAT_COOLDOWN || keyRepeatFrameCounter === 0) && keyRepeatFrameCounter % KEY_REPEATER === 0)
                keyRepeat();

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
    #settings = new Map();

    constructor() {
        this.#initializeSettings();
    }

    async #initializeSettings() {
        const order = Settings.order();
        const defaults = Settings.defaults();

        waitingFor++;
        waitingDescs[waitingDescs.lowestAvailable++] = "Retrieving settings...";

        try {
            let values = await this.#loadSettings();

            order.forEach((key, index) => {
                const value = values.length > 0 ? values.pop() : defaults[index];
                this.#settings.set(key, value);

                const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
                this[setterName] = (v, v2) => this.set(key, v, v2);

                Object.defineProperty(this, key, {
                    get: () => this.#settings.get(key)
                });
            });
        } catch (err) {
            console.error('Failed to initialize settings:', err);
        } finally {
            waitingFor--;
            waitingDescs[--waitingDescs.lowestAvailable] = undefined;
        }
    }

    async #loadSettings() {
        try {
            const dbSettings = await db.settings.get(DB_KEY_SETTINGS);
            if (dbSettings) return dbSettings;

            const lsKey = LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SETTINGS;
            const legacySettings = localStorage.getItem(lsKey);
            if (legacySettings) {
                const decoded = decodeB36StringArray(legacySettings);
                await db.settings.put(decoded, DB_KEY_SETTINGS);
                localStorage.removeItem(lsKey);
                return decoded;
            }
        } catch (err) {
            console.error('Error loading settings:', err);
        }
        return [];
    }

    static order() {
        return [
            "colorScheme",
            "speedUnit",
            "smoothLandColor",
            "showMagGlass",
            "snowLayers",
            "useShadows",
            "trackMode",
            "showStrength",
            "doAutosave"
        ];
    }

    static defaults() {
        return [0, 0, true, false, 2, false, 0, false, true];
    }

    async save() {
        const values = Settings.order().map(key => this.#settings.get(key));
        try {
            await db.settings.put(values, DB_KEY_SETTINGS);
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    }

    set(key, value, v2) {
        if (value === "toggle") {
            this.#settings.set(key, !this.#settings.get(key));
        } else if (value === "incmod") {
            this.#settings.set(key, (this.#settings.get(key) + 1) % v2);
        } else {
            this.#settings.set(key, value);
        }
        this.save();
    }
}
