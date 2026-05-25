    const APP_LANG = window.APP_LANG === "it" ? "it" : "en";

    const UI = {
        en: {
            general_settings: "General settings",
            number_rods: "Number of rods",
            initial_speed: "Initial speed [knots]",
            current_speed: "Current [knots]",
            current_direction: "Current direction [°]",
            apply_changes: "Apply changes",
            reset_defaults: "Reset defaults",
            rods: "Rods",
            slow_down: "Slow down",
            speed_up: "Speed up",
            left: "Left",
            right: "Right",
            hint: `
                Desktop: use keyboard arrows.<br>
                Smartphone: use the buttons below the simulation.<br>
                Negative current values mean current opposite to the selected direction.<br>
                Current direction: from -90° to +90° relative to the boat heading.<br>
                Rod base lateral position is limited between -5 m and +5 m.
            `,
            rod: "Rod",
            name: "Name",
            depth: "Depth m",
            diameter: "Diameter mm",
            legend_depth: "depth",
            lure_weight: "Lure weight g",
            line_length: "Line length m",
            lateral_base: "Lateral base m",
            rod_angle: "Rod angle °",
            target_speed: "Target speed",
            real_speed: "Real speed",
            boat_heading: "Boat heading",
            wake_length: "Wake length",
            current: "Current",
            crossing_risk: "Crossing risk",
            crossing_active: "Lines crossed",
            distance_label: "distance",
            depth_label: "depth",
            safe_label: "low",
            danger_label: "bird's nest"
        },
        it: {
            general_settings: "Parametri generali",
            number_rods: "Numero canne",
            initial_speed: "Velocità iniziale [nodi]",
            current_speed: "Corrente [nodi]",
            current_direction: "Direzione corrente [°]",
            apply_changes: "Carica modifiche",
            reset_defaults: "Reset valori default",
            rods: "Canne",
            slow_down: "Rallenta",
            speed_up: "Accelera",
            left: "Sinistra",
            right: "Destra",
            hint: `
                Da PC: puoi usare le frecce della tastiera.<br>
                Da smartphone: usa i pulsanti sotto la simulazione.<br>
                Corrente: valori negativi indicano corrente opposta al verso impostato.<br>
                Direzione corrente: da -90° a +90° rispetto alla rotta della barca.<br>
                La posizione laterale della base canna è limitata tra -5 m e +5 m.
            `,
            rod: "Canna",
            name: "Nome",
            depth: "Profondità m",
            diameter: "Diametro mm",
            legend_depth: "prof.",
            lure_weight: "Peso esca g",
            line_length: "Lenza m",
            lateral_base: "Base laterale m",
            rod_angle: "Angolo canna °",
            target_speed: "Velocità target",
            real_speed: "Velocità reale",
            boat_heading: "Rotta barca",
            wake_length: "Lunghezza scia",
            current: "Corrente",
            crossing_risk: "Rischio incrocio",
            crossing_active: "Lenze incrociate",
            distance_label: "distanza",
            depth_label: "profondità",
            safe_label: "basso",
            danger_label: "parrucca"
        }
    };

    const T = UI[APP_LANG];

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        el.textContent = T[key] || key;
    });

    document.querySelectorAll("[data-i18n-html]").forEach(el => {
        const key = el.getAttribute("data-i18n-html");
        el.innerHTML = T[key] || key;
    });

    let WIDTH = 1200;
    let HEIGHT = 700;
    let DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1;
    let PIXELS_PER_METER = 4.0;

    const KNOT_TO_MS = 0.514444;
    const MS_TO_KNOT = 1.94384;

    const DEFAULT_TROLLING_SPEED_KNOTS = 6.0;
    const MIN_TROLLING_SPEED_KNOTS = 0.0;
    const MAX_TROLLING_SPEED_KNOTS = 12.0;
    const TROLLING_SPEED_STEP_KNOTS = 0.15;

    const WATER_DENSITY = 1025.0;

    const BOAT_WIDTH_M = 2.0;
    const BOAT_LENGTH_M = 6.0;
    const ROD_LENGTH_M = 1.80;

    const MAX_ROD_BASE_LATERAL_M = 5.0;

    const DRAG_COEFF_LINE = 1.1;
    const DRAG_COEFF_LURE = 0.9;
    const LURE_REFERENCE_AREA = 0.0025;

    const LINE_POINT_MASS = 0.08;
    const LINE_DAMPING = 0.96;

    const MAX_POINT_SPEED = 18.0;
    const MAX_FORCE_LINE = 8.0;
    const MAX_FORCE_LURE = 25.0;

    const BOAT_TURN_RATE = 1.25;
    const BOAT_SPEED_RESPONSE = 0.85;

    const LINE_SEGMENTS_PER_ROD = 100;
    const LINE_CONSTRAINT_ITERATIONS = 60;

    const SAME_DEPTH_TOLERANCE_M = 0.30;

    /*
    Lo slider compare entro 2 m.
    */
    const LURE_LINE_VISIBLE_DISTANCE_M = 2.0;

    /*
    Il gomitolo compare entro 1.2 m.
    */
    const LURE_LINE_KNOB_VISIBLE_DISTANCE_M = 1.2;

    /*
    Da 1 m in giù il gomitolo inizia a muoversi verso il rosso.
    */
    const LURE_LINE_WARNING_DISTANCE_M = 1.0;

    /*
    Sotto questa distanza lo slider va al massimo.
    */
    const LURE_LINE_CROSSED_DISTANCE_M = 0.30;

    const canvas = document.getElementById("simCanvas");
    const ctx = canvas.getContext("2d");

    let keys = {};
    let touchControls = {
        up: false,
        down: false,
        left: false,
        right: false,
    };

    let rodsConfig = [];
    let boat = null;
    let lines = [];
    let config = null;
    let lastTime = performance.now();
    let crossingStates = new Map();
    let riskSlots = new Map();
    let nextRiskSlot = 0;

    const colors = [
        "#ffdc78",
        "#78dcff",
        "#ff8c8c",
        "#b4ffa0",
        "#dca0ff",
        "#ffffff",
        "#ffb450",
        "#a0dcdc",
    ];

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function normalizeAngleDeg(angle) {
        return ((angle + 180.0) % 360.0 + 360.0) % 360.0 - 180.0;
    }

    function vec(x = 0, y = 0) {
        return {x, y};
    }

    function add(a, b) {
        return {x: a.x + b.x, y: a.y + b.y};
    }

    function sub(a, b) {
        return {x: a.x - b.x, y: a.y - b.y};
    }

    function mul(a, s) {
        return {x: a.x * s, y: a.y * s};
    }

    function length(a) {
        return Math.hypot(a.x, a.y);
    }

    function normalize(a) {
        const l = length(a);
        if (l < 1e-9) return {x: 0, y: 0};
        return {x: a.x / l, y: a.y / l};
    }

    function limitVector(a, maxLen) {
        const l = length(a);
        if (l > maxLen && l > 1e-9) {
            return mul(a, maxLen / l);
        }
        return a;
    }

    function rotateVector(v, angleRad) {
        const c = Math.cos(angleRad);
        const s = Math.sin(angleRad);

        return {
            x: v.x * c - v.y * s,
            y: v.x * s + v.y * c,
        };
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();

        DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1;

        WIDTH = Math.max(320, Math.floor(rect.width));
        HEIGHT = Math.max(250, Math.floor(rect.height));

        canvas.width = Math.floor(WIDTH * DEVICE_PIXEL_RATIO);
        canvas.height = Math.floor(HEIGHT * DEVICE_PIXEL_RATIO);

        ctx.setTransform(
            DEVICE_PIXEL_RATIO,
            0,
            0,
            DEVICE_PIXEL_RATIO,
            0,
            0
        );
    }

    function defaultRodLayout(n) {
        if (n === 1) {
            return [[`${T.rod} 1`, 0.0, 0.0, 35.0, 3.5, 0.60, 40.0]];
        }

        if (n === 2) {
            return [
                [`${T.rod} 1`, -1.0, -90.0, 55.0, 0.0, 0.60, 40.0],
                [`${T.rod} 2`, +1.0, +90.0, 45.0, 0.0, 0.60, 40.0],
            ];
        }

        if (n === 3) {
            return [
                [`${T.rod} 1`, -1.0, -90.0, 45.0, 0.0, 0.60, 40.0],
                [`${T.rod} 2`, 0.0, 0.0, 35.0, 3.5, 0.60, 40.0],
                [`${T.rod} 3`, +1.0, +90.0, 55.0, 0.0, 0.60, 40.0],
            ];
        }

        if (n === 4) {
            return [
                [`${T.rod} 1`, -1.0, -90.0, 60.0, 0.0, 0.60, 40.0],
                [`${T.rod} 2`, -0.5, -30.0, 20.0, 3.5, 0.60, 40.0],
                [`${T.rod} 3`, +0.5, +30.0, 35.0, 3.5, 0.60, 40.0],
                [`${T.rod} 4`, +1.0, +90.0, 50.0, 0.0, 0.60, 40.0],
            ];
        }

        if (n === 5) {
            return [
                [`${T.rod} 1`, -5.0, -90.0, 70.0, 0.0, 0.60, 40.0],
                [`${T.rod} 2`, -1.0, -45.0, 60.0, 0.0, 0.60, 40.0],
                [`${T.rod} 3`, 0.0, 0.0, 35.0, 3.5, 0.60, 40.0],
                [`${T.rod} 4`, +1.0, +45.0, 50.0, 0.0, 0.60, 40.0],
                [`${T.rod} 5`, +5.0, +90.0, 40.0, 0.0, 0.60, 40.0],
            ];
        }

        if (n === 6) {
            return [
                [`${T.rod} 1`, -5.0, -90.0, 70.0, 0.0, 0.60, 40.0],
                [`${T.rod} 2`, -3.0, -60.0, 60.0, 0.0, 0.60, 40.0],
                [`${T.rod} 3`, -1.0, -30.0, 30.0, 3.5, 0.60, 40.0],
                [`${T.rod} 4`, +1.0, +30.0, 20.0, 3.5, 0.60, 40.0],
                [`${T.rod} 5`, +3.0, +60.0, 40.0, 0.0, 0.60, 40.0],
                [`${T.rod} 6`, +5.0, +90.0, 50.0, 0.0, 0.60, 40.0],
            ];
        }

        if (n === 7) {
            return [
                [`${T.rod} 1`, -5.0, -90.0, 60.0, 0.0, 0.60, 40.0],
                [`${T.rod} 2`, -3.0, -60.0, 50.0, 0.0, 0.60, 40.0],
                [`${T.rod} 3`, -1.0, -30.0, 30.0, 3.5, 0.60, 40.0],
                [`${T.rod} 4`,  0.0, 0.0, 100.0, 0.0, 0.60, 40.0],
                [`${T.rod} 5`, +1.0, +30.0, 20.0, 3.5, 0.60, 40.0],
                [`${T.rod} 6`, +3.0, +60.0, 50.0, 0.0, 0.60, 40.0],
                [`${T.rod} 7`, +5.0, +90.0, 60.0, 0.0, 0.60, 40.0],
            ];
        }

        let layout = [];

        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0.5 : i / (n - 1);
            const lateral = -5.0 + t * 10.0;
            const angle = -90.0 + t * 180.0;
            const len = 35.0;

            layout.push([
                `${T.rod} ${i + 1}`,
                lateral,
                angle,
                len,
                0.0,
                0.60,
                40.0
            ]);
        }

        return layout;
    }

    function makeRodConfig(
        name,
        lateral,
        angle,
        lengthValue,
        trollingDepthM = 0.0,
        lineDiameterMm = 0.60,
        lureMassG = 40.0
    ) {
        return {
            name: name,
            trollingDepthM: trollingDepthM,
            lineLengthM: lengthValue,
            lineDiameterMm: lineDiameterMm,
            lureMassG: lureMassG,
            rodBaseLateralM: lateral,
            rodAngleDeg: angle,
        };
    }

    function getNumberInput(id, fallback, minimum = null, maximum = null) {
        const element = document.getElementById(id);

        if (!element) {
            return fallback;
        }

        const parsed = parseFloat(element.value);
        let value = Number.isFinite(parsed) ? parsed : fallback;

        if (minimum !== null) {
            value = Math.max(minimum, value);
        }

        if (maximum !== null) {
            value = Math.min(maximum, value);
        }

        return value;
    }

    function readRodFromPanel(i, fallback) {
        const nameInput = document.getElementById(`rod_${i}_name`);

        if (!nameInput) {
            return {...fallback};
        }

        return {
            name: nameInput.value || fallback.name || `${T.rod} ${i + 1}`,
            trollingDepthM: getNumberInput(`rod_${i}_depth`, fallback.trollingDepthM, 0.0, null),
            lineLengthM: getNumberInput(`rod_${i}_length`, fallback.lineLengthM, 1.0, null),
            lineDiameterMm: getNumberInput(`rod_${i}_diameter`, fallback.lineDiameterMm, 0.01, null),
            lureMassG: getNumberInput(`rod_${i}_mass`, fallback.lureMassG, 1.0, null),
            rodBaseLateralM: getNumberInput(
                `rod_${i}_lateral`,
                fallback.rodBaseLateralM,
                -MAX_ROD_BASE_LATERAL_M,
                MAX_ROD_BASE_LATERAL_M
            ),
            rodAngleDeg: getNumberInput(`rod_${i}_angle`, fallback.rodAngleDeg, null, null),
        };
    }

    function collectCurrentRodValues() {
        const values = [];

        for (let i = 0; i < rodsConfig.length; i++) {
            values.push(readRodFromPanel(i, rodsConfig[i]));
        }

        return values;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    function renderRodsPanel() {
        const panel = document.getElementById("rodsPanel");
        panel.innerHTML = "";

        rodsConfig.forEach((rod, i) => {
            const div = document.createElement("div");
            div.className = "rod-card";

            div.innerHTML = `
                <h4>${T.rod} ${i + 1}</h4>

                <div class="row">
                    <label>${T.name}</label>
                    <input id="rod_${i}_name" type="text" value="${escapeHtml(rod.name)}">
                </div>

                <div class="row">
                    <label>${T.depth}</label>
                    <input id="rod_${i}_depth" type="number" step="1" value="${rod.trollingDepthM}">
                </div>

                <div class="row">
                    <label>${T.diameter}</label>
                    <input id="rod_${i}_diameter" type="number" step="0.05" value="${rod.lineDiameterMm}">
                </div>

                <div class="row">
                    <label>${T.lure_weight}</label>
                    <input id="rod_${i}_mass" type="number" step="5" value="${rod.lureMassG}">
                </div>

                <div class="row">
                    <label>${T.line_length}</label>
                    <input id="rod_${i}_length" type="number" step="1" value="${rod.lineLengthM}">
                </div>

                <div class="row">
                    <label>${T.lateral_base}</label>
                    <input id="rod_${i}_lateral" type="number" min="-5" max="5" step="0.1" value="${rod.rodBaseLateralM}">
                </div>

                <div class="row">
                    <label>${T.rod_angle}</label>
                    <input id="rod_${i}_angle" type="number" step="5" value="${rod.rodAngleDeg}">
                </div>
            `;

            panel.appendChild(div);
        });
    }

    function readGeneralConfig() {
        return {
            initialSpeedKnots: getNumberInput(
                "initialSpeed",
                DEFAULT_TROLLING_SPEED_KNOTS,
                MIN_TROLLING_SPEED_KNOTS,
                MAX_TROLLING_SPEED_KNOTS
            ),
            currentSpeedKnots: getNumberInput("currentSpeed", 0.0, -12.0, 12.0),
            currentDirectionDeg: getNumberInput("currentDirection", 0.0, -90.0, 90.0),
        };
    }

    function buildAppConfig(rods) {
        const general = readGeneralConfig();

        return {
            rods: rods,
            initialSpeedKnots: general.initialSpeedKnots,
            currentSpeedKnots: general.currentSpeedKnots,
            currentDirectionDeg: general.currentDirectionDeg,
        };
    }

    function initialiseRods() {
        const n = clamp(parseInt(document.getElementById("numRods").value || "7"), 1, 8);
        document.getElementById("numRods").value = n;

        rodsConfig = defaultRodLayout(n).map(item =>
            makeRodConfig(
                item[0],
                item[1],
                item[2],
                item[3],
                item[4],
                item[5],
                item[6]
            )
        );

        renderRodsPanel();
        resetSimulationWithConfig(buildAppConfig(rodsConfig));
    }

    function resetToDefaults() {
        document.getElementById("numRods").value = 7;
        document.getElementById("initialSpeed").value = DEFAULT_TROLLING_SPEED_KNOTS.toFixed(1);
        document.getElementById("currentSpeed").value = "0.0";
        document.getElementById("currentDirection").value = "0";

        rodsConfig = defaultRodLayout(7).map(item =>
            makeRodConfig(
                item[0],
                item[1],
                item[2],
                item[3],
                item[4],
                item[5],
                item[6]
            )
        );

        renderRodsPanel();
        resetSimulationWithConfig(buildAppConfig(rodsConfig));
    }

    function loadChanges() {
        const requestedN = clamp(parseInt(document.getElementById("numRods").value || "7"), 1, 8);
        document.getElementById("numRods").value = requestedN;

        const currentValues = collectCurrentRodValues();
        const layout = defaultRodLayout(requestedN);
        const newRods = [];

        /*
        Se il numero di canne cambia, carichiamo il layout default
        del nuovo numero di canne.
        Se il numero resta uguale, conserviamo i valori modificati a mano.
        */
        const numberChanged = requestedN !== currentValues.length;

        for (let i = 0; i < requestedN; i++) {
            if (!numberChanged && i < currentValues.length) {
                newRods.push(currentValues[i]);
            } else {
                newRods.push(
                    makeRodConfig(
                        layout[i][0],
                        layout[i][1],
                        layout[i][2],
                        layout[i][3],
                        layout[i][4],
                        layout[i][5],
                        layout[i][6]
                    )
                );
            }
        }

        rodsConfig = newRods;
        const newConfig = buildAppConfig(rodsConfig);

        renderRodsPanel();
        resetSimulationWithConfig(newConfig);
    }

    window.loadChanges = loadChanges;
    window.resetToDefaults = resetToDefaults;

    function currentVector(appConfig, boatHeading) {
        const speedMs = appConfig.currentSpeedKnots * KNOT_TO_MS;
        const angleRad = appConfig.currentDirectionDeg * Math.PI / 180.0;

        const currentDirection = rotateVector(boatHeading, angleRad);

        return mul(currentDirection, speedMs);
    }

    function interpolatedWakeLength(speedKnots) {
        const points = [
            [0.0, 0.0],
            [3.0, 5.0],
            [6.0, 15.0],
            [12.0, 30.0],
        ];

        if (speedKnots <= points[0][0]) return points[0][1];
        if (speedKnots >= points[points.length - 1][0]) return points[points.length - 1][1];

        for (let i = 0; i < points.length - 1; i++) {
            const [x0, y0] = points[i];
            const [x1, y1] = points[i + 1];

            if (speedKnots >= x0 && speedKnots <= x1) {
                const t = (speedKnots - x0) / (x1 - x0);
                return y0 + t * (y1 - y0);
            }
        }

        return 0.0;
    }

    class Boat {
        constructor(initialSpeedKnots) {
            this.position = vec(0, 0);
            this.headingAngle = 0.0;

            this.targetSpeedKnots = initialSpeedKnots;
            this.targetSpeedMs = initialSpeedKnots * KNOT_TO_MS;

            this.waterVelocity = mul(this.heading(), this.targetSpeedMs);
            this.velocity = {...this.waterVelocity};
        }

        heading() {
            return {
                x: Math.cos(this.headingAngle),
                y: Math.sin(this.headingAngle),
            };
        }

        right() {
            const h = this.heading();
            return {
                x: -h.y,
                y: h.x,
            };
        }

        update(dt, currentVec) {
            if (keys["ArrowUp"] || touchControls.up) {
                this.targetSpeedKnots += TROLLING_SPEED_STEP_KNOTS;
            }

            if (keys["ArrowDown"] || touchControls.down) {
                this.targetSpeedKnots -= TROLLING_SPEED_STEP_KNOTS;
            }

            this.targetSpeedKnots = clamp(
                this.targetSpeedKnots,
                MIN_TROLLING_SPEED_KNOTS,
                MAX_TROLLING_SPEED_KNOTS
            );

            this.targetSpeedMs = this.targetSpeedKnots * KNOT_TO_MS;

            if (keys["ArrowLeft"] || touchControls.left) {
                this.headingAngle -= BOAT_TURN_RATE * dt;
            }

            if (keys["ArrowRight"] || touchControls.right) {
                this.headingAngle += BOAT_TURN_RATE * dt;
            }

            const desiredWaterVelocity = mul(this.heading(), this.targetSpeedMs);

            this.waterVelocity = add(
                this.waterVelocity,
                mul(sub(desiredWaterVelocity, this.waterVelocity), BOAT_SPEED_RESPONSE * dt)
            );

            this.velocity = add(this.waterVelocity, currentVec);
            this.position = add(this.position, mul(this.velocity, dt));
        }
    }

    class Line {
        constructor(config, boatPosition, boatHeading, boatVelocity) {
            this.config = config;
            this.numSegments = LINE_SEGMENTS_PER_ROD;
            this.restLength = config.lineLengthM / this.numSegments;

            this.points = [];
            this.velocities = [];
            this.previousLurePoint = null;

            const initialAnchor = this.rodTipPoint(boatPosition, boatHeading);
            const backward = mul(boatHeading, -1);

            for (let i = 0; i <= this.numSegments; i++) {
                const p = add(initialAnchor, mul(backward, i * this.restLength));
                this.points.push(p);
                this.velocities.push({...boatVelocity});
            }
            this.previousLurePoint = {...this.points[this.points.length - 1]};
        }

        rodBasePoint(boatPosition, boatHeading) {
            const right = vec(-boatHeading.y, boatHeading.x);
            const sternOffset = mul(boatHeading, -BOAT_LENGTH_M * 0.35);

            return add(
                add(boatPosition, sternOffset),
                mul(right, this.config.rodBaseLateralM)
            );
        }

        rodTipPoint(boatPosition, boatHeading) {
            const base = this.rodBasePoint(boatPosition, boatHeading);
            const backward = mul(boatHeading, -1);
            const right = vec(-boatHeading.y, boatHeading.x);
            const angleRad = this.config.rodAngleDeg * Math.PI / 180.0;

            let rodDirection = add(
                mul(backward, Math.cos(angleRad)),
                mul(right, Math.sin(angleRad))
            );

            rodDirection = normalize(rodDirection);

            if (length(rodDirection) < 1e-9) {
                rodDirection = backward;
            }

            return add(base, mul(rodDirection, ROD_LENGTH_M));
        }

        update(dt, boatPosition, boatHeading, boatVelocity, currentVec) {
            const anchor = this.rodTipPoint(boatPosition, boatHeading);
            this.previousLurePoint = {...this.points[this.points.length - 1]};

            this.points[0] = {...anchor};
            this.velocities[0] = {...boatVelocity};

            const diameterM = this.config.lineDiameterMm / 1000.0;
            const segmentLength = this.restLength;
            const previousPoints = this.points.map(p => ({...p}));

            for (let i = 1; i < this.points.length; i++) {
                let point = this.points[i];
                let velocity = this.velocities[i];

                let force = vec(0, 0);

                const relativeVelocity = sub(velocity, currentVec);
                const speed = length(relativeVelocity);

                if (speed > 1e-6) {
                    const projectedAreaLine = diameterM * segmentLength;

                    let dragLine =
                        0.5 *
                        WATER_DENSITY *
                        DRAG_COEFF_LINE *
                        projectedAreaLine *
                        speed *
                        speed;

                    dragLine = Math.min(dragLine, MAX_FORCE_LINE);
                    force = add(force, mul(normalize(relativeVelocity), -dragLine));
                }

                if (i === this.points.length - 1 && speed > 1e-6) {
                    let dragLure =
                        0.5 *
                        WATER_DENSITY *
                        DRAG_COEFF_LURE *
                        LURE_REFERENCE_AREA *
                        speed *
                        speed;

                    dragLure = Math.min(dragLure, MAX_FORCE_LURE);
                    force = add(force, mul(normalize(relativeVelocity), -dragLure));
                }

                const depthFactor = 1.0 + this.config.trollingDepthM / 25.0;

                let effectiveMass;

                if (i === this.points.length - 1) {
                    const lureMassKg = this.config.lureMassG / 1000.0;
                    effectiveMass = LINE_POINT_MASS * depthFactor + lureMassKg;
                } else {
                    effectiveMass = LINE_POINT_MASS * depthFactor;
                }

                const acceleration = mul(force, 1.0 / effectiveMass);

                velocity = add(velocity, mul(acceleration, dt));
                velocity = limitVector(velocity, MAX_POINT_SPEED);
                velocity = mul(velocity, LINE_DAMPING);

                point = add(point, mul(velocity, dt));

                if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                    point = {...this.points[i - 1]};
                    velocity = vec(0, 0);
                }

                this.points[i] = point;
                this.velocities[i] = velocity;
            }

            for (let iter = 0; iter < LINE_CONSTRAINT_ITERATIONS; iter++) {
                this.points[0] = {...anchor};

                for (let i = 0; i < this.points.length - 1; i++) {
                    const p1 = this.points[i];
                    const p2 = this.points[i + 1];

                    const delta = sub(p2, p1);
                    const dist = length(delta);

                    if (dist < 1e-9) continue;

                    const difference = (dist - this.restLength) / dist;

                    if (i === 0) {
                        this.points[i + 1] = sub(this.points[i + 1], mul(delta, difference));
                    } else {
                        const correction = mul(delta, 0.5 * difference);
                        this.points[i] = add(this.points[i], correction);
                        this.points[i + 1] = sub(this.points[i + 1], correction);
                    }
                }
            }

            for (let i = 1; i < this.points.length; i++) {
                this.velocities[i] = mul(
                    sub(this.points[i], previousPoints[i]),
                    1.0 / Math.max(dt, 1e-6)
                );

                this.velocities[i] = limitVector(this.velocities[i], MAX_POINT_SPEED);
            }
        }
    }

    function resetSimulationWithConfig(appConfig) {
        config = appConfig;
        boat = new Boat(config.initialSpeedKnots);

        crossingStates.clear();
        riskSlots.clear();
        nextRiskSlot = 0;

        const initialCurrent = currentVector(config, boat.heading());
        boat.velocity = add(boat.waterVelocity, initialCurrent);

        lines = config.rods.map(
            rod => new Line(
                rod,
                boat.position,
                boat.heading(),
                boat.velocity
            )
        );

        lastTime = performance.now();
        resizeCanvas();
        canvas.focus();
    }

    function getSceneBounds() {
        if (!boat || lines.length === 0) {
            return {minX: -10, maxX: 10, minY: -10, maxY: 10};
        }

        let minX = boat.position.x;
        let maxX = boat.position.x;
        let minY = boat.position.y;
        let maxY = boat.position.y;

        const heading = boat.heading();
        const right = boat.right();

        const boatPoints = [
            add(boat.position, mul(heading, BOAT_LENGTH_M)),
            sub(boat.position, mul(heading, BOAT_LENGTH_M)),
            add(boat.position, mul(right, BOAT_WIDTH_M)),
            sub(boat.position, mul(right, BOAT_WIDTH_M)),
        ];

        boatPoints.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        lines.forEach(line => {
            line.points.forEach(p => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
        });

        const marginM = 6.0;

        return {
            minX: minX - marginM,
            maxX: maxX + marginM,
            minY: minY - marginM,
            maxY: maxY + marginM,
        };
    }

    function updateWorldScaleFromScene() {
        if (!boat || lines.length === 0 || WIDTH >= 700) {
            PIXELS_PER_METER = 4.0;
            return;
        }

        const bounds = getSceneBounds();

        const sceneWidthM = Math.max(10, bounds.maxX - bounds.minX);
        const sceneHeightM = Math.max(10, bounds.maxY - bounds.minY);

        const scaleX = WIDTH * 0.92 / sceneWidthM;
        const scaleY = HEIGHT * 0.78 / sceneHeightM;

        PIXELS_PER_METER = clamp(
            Math.min(scaleX, scaleY),
            2.8,
            7.0
        );
    }

    function getSmartCamera() {
        if (!boat || lines.length === 0 || WIDTH >= 700) {
            return boat ? boat.position : vec(0, 0);
        }

        const bounds = getSceneBounds();

        return vec(
            (bounds.minX + bounds.maxX) / 2,
            (bounds.minY + bounds.maxY) / 2
        );
    }

    function worldToScreen(point, camera) {
        const x = WIDTH / 2 + (point.x - camera.x) * PIXELS_PER_METER;
        const y = HEIGHT / 2 + (point.y - camera.y) * PIXELS_PER_METER;

        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

        return {
            x: Math.round(x),
            y: Math.round(y),
        };
    }

    function pointSegmentDistance(point, a, b) {
        const ab = sub(b, a);
        const ap = sub(point, a);

        const abLenSq = ab.x * ab.x + ab.y * ab.y;

        if (abLenSq < 1e-12) {
            return length(sub(point, a));
        }

        let t = (ap.x * ab.x + ap.y * ab.y) / abLenSq;
        t = clamp(t, 0.0, 1.0);

        const closest = add(a, mul(ab, t));
        return length(sub(point, closest));
    }

    function signedSideOfPoint(point, a, b) {
        const ab = sub(b, a);
        const ap = sub(point, a);

        const cross = ab.x * ap.y - ab.y * ap.x;

        if (Math.abs(cross) < 1e-9) {
            return 0;
        }

        return cross > 0 ? 1 : -1;
    }

    function closestLineSegmentInfo(point, otherLine) {
        let minDistance = Infinity;
        let bestA = null;
        let bestB = null;

        for (let i = 1; i < otherLine.points.length - 1; i++) {
            const a = otherLine.points[i];
            const b = otherLine.points[i + 1];

            const d = pointSegmentDistance(point, a, b);

            if (d < minDistance) {
                minDistance = d;
                bestA = a;
                bestB = b;
            }
        }

        if (!bestA || !bestB) {
            return {
                distance: Infinity,
                side: 0
            };
        }

        return {
            distance: minDistance,
            side: signedSideOfPoint(point, bestA, bestB)
        };
    }

    function orientation(a, b, c) {
        const value =
            (b.y - a.y) * (c.x - b.x) -
            (b.x - a.x) * (c.y - b.y);

        if (Math.abs(value) < 1e-9) {
            return 0;
        }

        return value > 0 ? 1 : 2;
    }

    function onSegment(a, b, c) {
        return (
            b.x <= Math.max(a.x, c.x) + 1e-9 &&
            b.x >= Math.min(a.x, c.x) - 1e-9 &&
            b.y <= Math.max(a.y, c.y) + 1e-9 &&
            b.y >= Math.min(a.y, c.y) - 1e-9
        );
    }

    function segmentsIntersect(p1, q1, p2, q2) {
        const o1 = orientation(p1, q1, p2);
        const o2 = orientation(p1, q1, q2);
        const o3 = orientation(p2, q2, p1);
        const o4 = orientation(p2, q2, q1);

        if (o1 !== o2 && o3 !== o4) {
            return true;
        }

        if (o1 === 0 && onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && onSegment(p2, q1, q2)) return true;

        return false;
    }

    function minLureDistanceToLine(lurePoint, otherLine) {
        let minDistance = Infinity;

        /*
        Partiamo da 1 per ignorare il primissimo tratto vicino alla punta canna.
        Così il controllo riguarda soprattutto la lenza effettivamente in acqua.
        */
        for (let i = 1; i < otherLine.points.length - 1; i++) {
            const a = otherLine.points[i];
            const b = otherLine.points[i + 1];

            const d = pointSegmentDistance(lurePoint, a, b);

            if (d < minDistance) {
                minDistance = d;
            }
        }

        return minDistance;
    }

    function finalSegmentCrossingInfo(lineWithLure, otherLine) {
        /*
          Controlla se il segmento finale della lenza:
          penultimo punto -> esca
          interseca qualsiasi segmento dell'altra lenza.
    
          Questo è il controllo corretto per capire se il terminale/esca
          ha scavalcato un'altra lenza.
        */
        if (
            !lineWithLure.points ||
            !otherLine.points ||
            lineWithLure.points.length < 2 ||
            otherLine.points.length < 2
        ) {
            return {
                crossed: false,
                segmentIndex: -1
            };
        }
    
        const n = lineWithLure.points.length;
        const finalA = lineWithLure.points[n - 2];
        const finalB = lineWithLure.points[n - 1];
    
        /*
          Partiamo da 1 o 2 per evitare falsi positivi vicino alla punta canna.
          Se vuoi essere più sensibile, usa 1.
          Se vedi falsi incroci vicino alla barca, usa 2.
        */
        const startOther = 1;
    
        for (let i = startOther; i < otherLine.points.length - 1; i++) {
            const otherA = otherLine.points[i];
            const otherB = otherLine.points[i + 1];
    
            if (segmentsIntersect(finalA, finalB, otherA, otherB)) {
                return {
                    crossed: true,
                    segmentIndex: i
                };
            }
        }
    
        return {
            crossed: false,
            segmentIndex: -1
        };
    }

    function evaluateRodPair(i, j, lineA, lineB) {
        const pairKey = `${i}<->${j}`;
        const pairLabel = `${lineA.config.name} ↔ ${lineB.config.name}`;
    
        const lureA = lineA.points[lineA.points.length - 1];
        const lureB = lineB.points[lineB.points.length - 1];
    
        const infoAB = closestLineSegmentInfo(lureA, lineB);
        const infoBA = closestLineSegmentInfo(lureB, lineA);
    
        const distanceAB = infoAB.distance;
        const distanceBA = infoBA.distance;
    
        let state = crossingStates.get(pairKey);
    
        if (!state) {
            state = {
                locked: false,
                crossingCount: 0,
                justResolved: false,
                visualSeverity: 0.0,
    
                /*
                  Direzione usata solo per mostrare la distanza:
                  i -> j significa: segmento finale della canna i
                  ha attraversato la lenza della canna j.
                  Lo sblocco resta invece legato alla coppia non ordinata.
                */
                activeLureIndex: null,
                activeLineIndex: null,
    
                /*
                  Anti-toggle: evita di contare più eventi mentre il segmento finale
                  resta sovrapposto alla stessa lenza per più frame.
                */
                wasInContactAB: false,
                wasInContactBA: false,
    
                /*
                  Serve dopo lo sblocco per far scendere il gomitolo
                  dalla distanza della direzione corretta.
                */
                releaseLureIndex: null,
                releaseLineIndex: null
            };
    
            crossingStates.set(pairKey, state);
        }

        if (!Number.isFinite(state.crossingCount)) {
            state.crossingCount = state.locked ? 1 : 0;
        }
    
        /*
          Controllo corretto:
          segmento finale della lenza A contro qualsiasi segmento della lenza B,
          e viceversa.
        */
        const crossingAB = finalSegmentCrossingInfo(lineA, lineB);
        const crossingBA = finalSegmentCrossingInfo(lineB, lineA);
    
        const eventAB = crossingAB.crossed && !state.wasInContactAB;
        const eventBA = crossingBA.crossed && !state.wasInContactBA;
    
        state.wasInContactAB = crossingAB.crossed;
        state.wasInContactBA = crossingBA.crossed;
    
        function startCrossing(lureIndex, lineIndex) {
            state.locked = true;
            state.crossingCount = 1;
            state.justResolved = false;
            state.visualSeverity = 1.0;
    
            state.activeLureIndex = lureIndex;
            state.activeLineIndex = lineIndex;
    
            state.releaseLureIndex = null;
            state.releaseLineIndex = null;
        }
    
        function resolveCrossing(lureIndex, lineIndex) {
            state.locked = false;
            state.crossingCount = 0;
            state.justResolved = true;
            state.visualSeverity = 1.0;

            state.releaseLureIndex = lureIndex;
            state.releaseLineIndex = lineIndex;

            state.activeLureIndex = null;
            state.activeLineIndex = null;
        }
    
        /*
          Primo attraversamento della coppia non ordinata: blocca in MAX.
          Secondo attraversamento della stessa coppia non ordinata: sblocca.
          Se entrambi i terminali generano un evento nello stesso frame,
          la coppia conta comunque un solo attraversamento.
        */
        const hasPairEvent = eventAB || eventBA;

        if (hasPairEvent) {
            const eventLureIndex = eventAB ? i : j;
            const eventLineIndex = eventAB ? j : i;

            if (state.locked || state.crossingCount === 1) {
                resolveCrossing(eventLureIndex, eventLineIndex);
            } else {
                startCrossing(eventLureIndex, eventLineIndex);
            }
        }
    
        /*
          Caso 1: incrocio attivo.
          Rimane MAX indipendentemente dalla distanza.
        */
        if (state.locked) {
            const activeDistance =
                state.activeLureIndex === i && state.activeLineIndex === j
                    ? distanceAB
                    : distanceBA;
    
            return {
                pairKey: pairKey,
                pairA: i,
                pairB: j,
                pairLabel: pairLabel,
                lureRod: pairLabel,
                lineRod: "",
                depth: lineA.config.trollingDepthM,
                distance: activeDistance,
                crossed: true,
                veryClose: true,
                severity: 1.0,
                forceKnob: true
            };
        }
    
        /*
          Caso 2: incrocio appena risolto.
          Lo slider non sparisce subito: scende progressivamente da MAX.
        */
        if (state.justResolved) {
            const releaseDistance =
                state.releaseLureIndex === i && state.releaseLineIndex === j
                    ? distanceAB
                    : distanceBA;
    
            const targetSeverity = clamp(
                1.0 - releaseDistance / LURE_LINE_WARNING_DISTANCE_M,
                0.0,
                1.0
            );
    
            state.visualSeverity = Math.max(
                targetSeverity,
                state.visualSeverity - 0.025
            );
    
            if (state.visualSeverity <= Math.max(targetSeverity, 0.02)) {
                state.justResolved = false;
                state.visualSeverity = targetSeverity;
            }
    
            const shouldShow =
                state.justResolved ||
                releaseDistance <= LURE_LINE_VISIBLE_DISTANCE_M;
    
            if (!shouldShow) {
                return null;
            }
    
            return {
                pairKey: pairKey,
                pairA: i,
                pairB: j,
                pairLabel: pairLabel,
                lureRod: pairLabel,
                lineRod: "",
                depth: lineA.config.trollingDepthM,
                distance: releaseDistance,
                crossed: false,
                veryClose: releaseDistance <= LURE_LINE_CROSSED_DISTANCE_M,
                severity: state.visualSeverity,
                forceKnob: true
            };
        }
    
        /*
          Caso 3: rischio normale.
          Una sola riga per coppia: scegliamo la direzione più pericolosa.
        */
        const severityAB = clamp(
            1.0 - distanceAB / LURE_LINE_WARNING_DISTANCE_M,
            0.0,
            1.0
        );
    
        const severityBA = clamp(
            1.0 - distanceBA / LURE_LINE_WARNING_DISTANCE_M,
            0.0,
            1.0
        );
    
        const useAB = severityAB >= severityBA;
    
        const selectedDistance = useAB ? distanceAB : distanceBA;
        const selectedSeverity = useAB ? severityAB : severityBA;
    
        if (selectedDistance > LURE_LINE_VISIBLE_DISTANCE_M) {
            return null;
        }
    
        const veryClose =
            selectedDistance <= LURE_LINE_CROSSED_DISTANCE_M;
    
        return {
            pairKey: pairKey,
            pairA: i,
            pairB: j,
            pairLabel: pairLabel,
            lureRod: pairLabel,
            lineRod: "",
            depth: lineA.config.trollingDepthM,
            distance: selectedDistance,
            crossed: false,
            veryClose: veryClose,
            severity: veryClose ? 1.0 : selectedSeverity,
            forceKnob:
                veryClose ||
                selectedDistance <= LURE_LINE_KNOB_VISIBLE_DISTANCE_M
        };
    }

    function getLineCrossingRisks() {
        const risks = [];

        if (!lines || lines.length < 2) {
            crossingStates.clear();
            return risks;
        }

        const seenPairs = new Set();

        for (let i = 0; i < lines.length; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                const lineA = lines[i];
                const lineB = lines[j];

                if (
                    !lineA.points ||
                    !lineB.points ||
                    lineA.points.length < 2 ||
                    lineB.points.length < 2
                ) {
                    continue;
                }

                const depthA = lineA.config.trollingDepthM;
                const depthB = lineB.config.trollingDepthM;

                const sameDepth =
                    Math.abs(depthA - depthB) <= SAME_DEPTH_TOLERANCE_M;

                if (!sameDepth) {
                    continue;
                }

                const pairKey = `${i}<->${j}`;
                seenPairs.add(pairKey);

                const risk = evaluateRodPair(i, j, lineA, lineB);

                if (risk) {
                    risks.push(risk);
                }
            }
        }

        /*
        Pulizia degli stati relativi a coppie che non esistono più.
        */
        for (const key of crossingStates.keys()) {
            if (!seenPairs.has(key)) {
                crossingStates.delete(key);
            }
        }

        /*
        Ordine stabile per coppia.
        Gli slot poi decidono la posizione verticale stabile.
        */
        risks.sort((a, b) => {
            if (a.pairA !== b.pairA) {
                return a.pairA - b.pairA;
            }

            return a.pairB - b.pairB;
        });

        return risks;
    }

    function assignRiskSlots(risks) {
        const activeKeys = new Set(risks.map(risk => risk.pairKey));

        /*
        Rimuove dagli slot le coppie che non sono più visibili.
        Gli altri slot non vengono rinumerati: così le righe non scorrono.
        */
        for (const key of Array.from(riskSlots.keys())) {
            if (!activeKeys.has(key)) {
                riskSlots.delete(key);
            }
        }

        /*
        Le nuove coppie vengono messe nello slot libero più basso.
        Siccome disegneremo gli slot dal basso verso l'alto,
        lo slot 0 è quello più basso.
        */
        for (const risk of risks) {
            if (!riskSlots.has(risk.pairKey)) {
                let slot = 0;

                const occupiedSlots = new Set(riskSlots.values());

                while (occupiedSlots.has(slot)) {
                    slot += 1;
                }

                riskSlots.set(risk.pairKey, slot);
                nextRiskSlot = Math.max(nextRiskSlot, slot + 1);
            }

            risk.slot = riskSlots.get(risk.pairKey);
        }
    }

    function getVisibleRiskSlots(risks, maxItems) {
        assignRiskSlots(risks);

        /*
        Mostriamo al massimo maxItems slot.
        Se ce ne sono più di quanti stanno nel pannello, teniamo quelli più bassi.
        Questo mantiene stabile la logica "nuovi sopra, primi in basso".
        */
        return risks
            .filter(risk => Number.isFinite(risk.slot))
            .filter(risk => risk.slot < maxItems);
    }

    function drawLineCrossingIndicators(camera) {
        const risks = getLineCrossingRisks();

        if (risks.length === 0) {
            riskSlots.clear();
            return;
        }

        const smallScreen = WIDTH < 600;

        const maxItems = smallScreen ? 3 : 5;
        const visibleRisks = getVisibleRiskSlots(risks, maxItems);

        if (visibleRisks.length === 0) {
            return;
        }

        const cardWidth = smallScreen
            ? Math.min(WIDTH - 20, 360)
            : Math.min(340, WIDTH - 24);

        const rowHeight = smallScreen ? 52 : 58;
        const headerHeight = smallScreen ? 34 : 40;

        /*
        Il pannello mantiene l'altezza massima, così le righe non si muovono
        quando una coppia appare o sparisce.
        */
        const cardHeight = headerHeight + rowHeight * maxItems + 12;

        const x = WIDTH - cardWidth - (smallScreen ? 10 : 12);
        const y = HEIGHT - cardHeight - (smallScreen ? 10 : 12);

        ctx.save();

        ctx.fillStyle = "rgba(18, 56, 79, 0.88)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
        ctx.lineWidth = 1.5;

        roundRect(ctx, x, y, cardWidth, cardHeight, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = smallScreen
            ? "bold 13px Arial, sans-serif"
            : "bold 17px Arial, sans-serif";

        ctx.fillText(`⚠ ${T.crossing_risk}`, x + 14, y + 25);

        const hiddenCount = risks.length - visibleRisks.length;

        if (hiddenCount > 0) {
            ctx.font = smallScreen
                ? "bold 12px Arial, sans-serif"
                : "bold 14px Arial, sans-serif";

            ctx.fillText(
                `+${hiddenCount}`,
                x + cardWidth - 42,
                y + 25
            );
        }

        for (const risk of visibleRisks) {
            /*
            slot 0 = riga più bassa
            slot 1 = riga sopra
            slot 2 = ancora sopra
            */
            const visualRowFromTop = maxItems - 1 - risk.slot;
            const rowY = y + headerHeight + visualRowFromTop * rowHeight;

            drawCrossingRiskSlider(
                risk,
                x + 14,
                rowY + 4,
                cardWidth - 28,
                rowHeight - 8,
                smallScreen
            );
        }

        ctx.restore();
    }

    function drawCrossingRiskSlider(risk, x, y, width, height, smallScreen) {
        /*
        Slider:
        - visibile da distanza <= 2.0 m
        - gomitolo visibile da distanza <= 1.2 m
    
        severity:
        0.0 = distanza >= 1.0 m, giallo, gomitolo fermo a sinistra
        1.0 = distanza <= 0.30 m o lenze incrociate, rosso massimo
        */
        const severity = clamp(
            Number.isFinite(risk.severity) ? risk.severity : 0.0,
            0.0,
            1.0
        );
    
        const showKnob =
            risk.forceKnob ||
            risk.crossed ||
            risk.veryClose ||
            risk.distance <= LURE_LINE_KNOB_VISIBLE_DISTANCE_M;
    
        /*
          MAX deve comparire sia quando la coppia è davvero incrociata,
          sia quando l'esca è molto vicina alla lenza, cioè <= 0.30 m.
        */
        const isMaxRisk = risk.crossed || risk.veryClose;
    
        const title = risk.crossed ? T.crossing_active : T.crossing_risk;
    
        const label =
            `${title}: ${risk.pairLabel}`;
    
        const details =
            `${T.distance_label}: ${risk.distance.toFixed(2)} m · ` +
            `${T.depth_label}: ${risk.depth.toFixed(1)} m`;
    
        const labelFont = smallScreen
            ? "bold 11px Arial, sans-serif"
            : "bold 13px Arial, sans-serif";
    
        const detailFont = smallScreen
            ? "10px Arial, sans-serif"
            : "12px Arial, sans-serif";
    
        const sliderX = x;
        const sliderY = y + (smallScreen ? 27 : 31);
        const sliderW = width;
        const sliderH = smallScreen ? 12 : 14;
    
        const knobRadius = smallScreen ? 10 : 12;
    
        const knobX = sliderX + severity * sliderW;
        const knobY = sliderY + sliderH / 2;
    
        ctx.save();
    
        /*
          Riga testuale sopra lo slider
        */
        ctx.fillStyle = "#ffffff";
        ctx.font = labelFont;
        ctx.fillText(label, x, y + 13);
    
        ctx.font = detailFont;
        ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
        ctx.fillText(details, x, y + 27);
    
        /*
          Sfondo slider
        */
        const gradient = ctx.createLinearGradient(sliderX, 0, sliderX + sliderW, 0);
    
        gradient.addColorStop(0.00, "rgb(255, 224, 70)");
        gradient.addColorStop(0.50, "rgb(255, 145, 35)");
        gradient.addColorStop(1.00, "rgb(220, 40, 35)");
    
        roundRect(ctx, sliderX, sliderY, sliderW, sliderH, 999);
        ctx.fillStyle = gradient;
        ctx.fill();
    
        /*
          Bordo slider
        */
        ctx.strokeStyle = "rgba(255, 255, 255, 0.52)";
        ctx.lineWidth = 1.2;
        roundRect(ctx, sliderX, sliderY, sliderW, sliderH, 999);
        ctx.stroke();
    
        /*
          Etichette estremi
        */
        ctx.font = smallScreen
            ? "9px Arial, sans-serif"
            : "10px Arial, sans-serif";
    
        ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
        ctx.fillText(T.safe_label, sliderX, sliderY + sliderH + 14);
    
        const dangerText = T.danger_label;
        const dangerWidth = ctx.measureText(dangerText).width;
        ctx.fillText(dangerText, sliderX + sliderW - dangerWidth, sliderY + sliderH + 14);
    
        /*
          Cursore gomitolo.
          Compare solo entro 1.2 m oppure quando l'incrocio è attivo.
        */
        if (showKnob) {
            ctx.beginPath();
            ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
            ctx.fillStyle = isMaxRisk
                ? "rgba(130, 0, 0, 0.98)"
                : "rgba(255, 255, 255, 0.95)";
            ctx.fill();
    
            ctx.strokeStyle = isMaxRisk
                ? "rgba(255, 255, 255, 0.95)"
                : "rgba(60, 40, 0, 0.85)";
            ctx.lineWidth = 2;
            ctx.stroke();
    
            ctx.font = smallScreen
                ? "15px Arial, sans-serif"
                : "18px Arial, sans-serif";
    
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#ffffff";
            ctx.fillText("🧶", knobX, knobY + 0.5);
    
            ctx.textAlign = "start";
            ctx.textBaseline = "alphabetic";
        }
    
        /*
          Badge MAX:
          compare sia per lenze incrociate, sia quando distanza <= 0.30 m.
        */
        if (isMaxRisk) {
            const badgeText = "MAX";
            ctx.font = smallScreen
                ? "bold 9px Arial, sans-serif"
                : "bold 10px Arial, sans-serif";
    
            const badgeW = ctx.measureText(badgeText).width + 12;
            const badgeH = smallScreen ? 16 : 18;
            const badgeX = sliderX + sliderW - badgeW;
            const badgeY = y + 2;
    
            ctx.fillStyle = "rgba(220, 40, 35, 0.95)";
            roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 999);
            ctx.fill();
    
            ctx.fillStyle = "#ffffff";
            ctx.fillText(badgeText, badgeX + 6, badgeY + badgeH - 5);
        }
    
        ctx.restore();
    }

    function roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function drawGrid(camera) {
        const gridSpacingM = 20;
        const gridSpacingPx = gridSpacingM * PIXELS_PER_METER;

        let offsetX = (-camera.x * PIXELS_PER_METER) % gridSpacingPx;
        let offsetY = (-camera.y * PIXELS_PER_METER) % gridSpacingPx;

        if (offsetX < 0) offsetX += gridSpacingPx;
        if (offsetY < 0) offsetY += gridSpacingPx;

        ctx.strokeStyle = "#1e5a82";
        ctx.lineWidth = 1;

        for (let x = offsetX; x < WIDTH; x += gridSpacingPx) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, HEIGHT);
            ctx.stroke();
        }

        for (let y = offsetY; y < HEIGHT; y += gridSpacingPx) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(WIDTH, y);
            ctx.stroke();
        }
    }

    function drawEngineWake(camera) {
        if (!boat) return;

        const wakeLengthM = interpolatedWakeLength(boat.targetSpeedKnots);
        if (wakeLengthM <= 0.05) return;

        const targetRatio = clamp(boat.targetSpeedKnots / MAX_TROLLING_SPEED_KNOTS, 0.0, 1.0);
        const realSpeedKnots = length(boat.waterVelocity) * MS_TO_KNOT;
        const realRatio = clamp(realSpeedKnots / MAX_TROLLING_SPEED_KNOTS, 0.0, 1.0);

        const heading = boat.heading();
        const right = boat.right();

        const sternCenter = sub(
            boat.position,
            mul(heading, BOAT_LENGTH_M / 2 + 0.35)
        );

        const wakeWidthStartM = 0.20 + 0.30 * realRatio;
        const wakeWidthEndM = 0.80 + 2.80 * realRatio;
        const layers = 8;

        ctx.save();

        for (let layer = 0; layer < layers; layer++) {
            const t0 = layer / layers;
            const t1 = (layer + 1) / layers;

            const p0 = sub(sternCenter, mul(heading, wakeLengthM * t0));
            const p1 = sub(sternCenter, mul(heading, wakeLengthM * t1));

            const width0 = wakeWidthStartM + (wakeWidthEndM - wakeWidthStartM) * t0;
            const width1 = wakeWidthStartM + (wakeWidthEndM - wakeWidthStartM) * t1;

            const left0 = sub(p0, mul(right, width0 / 2));
            const right0 = add(p0, mul(right, width0 / 2));
            const right1 = add(p1, mul(right, width1 / 2));
            const left1 = sub(p1, mul(right, width1 / 2));

            const points = [
                worldToScreen(left0, camera),
                worldToScreen(right0, camera),
                worldToScreen(right1, camera),
                worldToScreen(left1, camera),
            ];

            if (points.some(p => p === null)) continue;

            const alpha = (0.23 * realRatio) * (1.0 - t0);

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.lineTo(points[2].x, points[2].y);
            ctx.lineTo(points[3].x, points[3].y);
            ctx.closePath();

            ctx.fillStyle = `rgba(215, 245, 255, ${alpha})`;
            ctx.fill();
        }

        const foamLines = 5;

        for (let i = 0; i < foamLines; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const offsetFactor = 0.18 + 0.13 * i;

            const start = add(
                sternCenter,
                mul(right, side * wakeWidthStartM * offsetFactor)
            );

            const end = add(
                sub(sternCenter, mul(heading, wakeLengthM * (0.45 + 0.09 * i))),
                mul(right, side * wakeWidthEndM * offsetFactor)
            );

            const startScreen = worldToScreen(start, camera);
            const endScreen = worldToScreen(end, camera);

            if (!startScreen || !endScreen) continue;

            ctx.beginPath();
            ctx.moveTo(startScreen.x, startScreen.y);
            ctx.lineTo(endScreen.x, endScreen.y);
            ctx.strokeStyle = `rgba(235, 250, 255, ${0.45 * realRatio})`;
            ctx.lineWidth = Math.max(1, 1 + 2.5 * targetRatio);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawPolygon(points, fill, stroke, width = 2) {
        if (points.some(p => p === null)) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
    }

    function drawBoat(camera) {
        const heading = boat.heading();
        const right = boat.right();

        const halfLength = BOAT_LENGTH_M / 2;
        const halfWidth = BOAT_WIDTH_M / 2;

        const bowTip = add(boat.position, mul(heading, halfLength + 0.35));
        const bowLeft = sub(add(boat.position, mul(heading, halfLength - 1.10)), mul(right, halfWidth));
        const bowRight = add(add(boat.position, mul(heading, halfLength - 1.10)), mul(right, halfWidth));

        const midLeft = sub(boat.position, mul(right, halfWidth));
        const midRight = add(boat.position, mul(right, halfWidth));

        const sternLeft = sub(sub(boat.position, mul(heading, halfLength)), mul(right, halfWidth));
        const sternRight = add(sub(boat.position, mul(heading, halfLength)), mul(right, halfWidth));

        const hull = [
            bowTip,
            bowRight,
            midRight,
            sternRight,
            sternLeft,
            midLeft,
            bowLeft,
        ].map(p => worldToScreen(p, camera));

        drawPolygon(hull, "#eeeeee", "#222222", 2);

        const cabinCenter = add(boat.position, mul(heading, 0.45));
        const cabinLength = 1.65;
        const cabinWidth = 1.05;

        const c1 = sub(add(cabinCenter, mul(heading, cabinLength / 2)), mul(right, cabinWidth / 2));
        const c2 = add(add(cabinCenter, mul(heading, cabinLength / 2)), mul(right, cabinWidth / 2));
        const c3 = add(sub(cabinCenter, mul(heading, cabinLength / 2)), mul(right, cabinWidth / 2));
        const c4 = sub(sub(cabinCenter, mul(heading, cabinLength / 2)), mul(right, cabinWidth / 2));

        drawPolygon(
            [c1, c2, c3, c4].map(p => worldToScreen(p, camera)),
            "#b4d2e1",
            "#222222",
            2
        );

        const engineCenter = sub(boat.position, mul(heading, halfLength + 0.35));
        const engineLength = 0.55;
        const engineWidth = 0.45;

        const e1 = sub(add(engineCenter, mul(heading, engineLength / 2)), mul(right, engineWidth / 2));
        const e2 = add(add(engineCenter, mul(heading, engineLength / 2)), mul(right, engineWidth / 2));
        const e3 = add(sub(engineCenter, mul(heading, engineLength / 2)), mul(right, engineWidth / 2));
        const e4 = sub(sub(engineCenter, mul(heading, engineLength / 2)), mul(right, engineWidth / 2));

        drawPolygon(
            [e1, e2, e3, e4].map(p => worldToScreen(p, camera)),
            "#333333",
            "#111111",
            2
        );
    }

    function drawRods(camera) {
        lines.forEach(line => {
            const base = line.rodBasePoint(boat.position, boat.heading());
            const tip = line.rodTipPoint(boat.position, boat.heading());

            const baseScreen = worldToScreen(base, camera);
            const tipScreen = worldToScreen(tip, camera);

            if (!baseScreen || !tipScreen) return;

            ctx.strokeStyle = "#282828";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(baseScreen.x, baseScreen.y);
            ctx.lineTo(tipScreen.x, tipScreen.y);
            ctx.stroke();

            ctx.fillStyle = "#282828";
            ctx.beginPath();
            ctx.arc(baseScreen.x, baseScreen.y, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#fadc78";
            ctx.beginPath();
            ctx.arc(tipScreen.x, tipScreen.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawLine(line, camera, color) {
        const screenPoints = [];

        for (let i = 0; i < line.points.length; i++) {
            const p = worldToScreen(line.points[i], camera);
            if (p !== null) {
                screenPoints.push(p);
            }
        }

        if (screenPoints.length >= 2) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);

            for (let i = 1; i < screenPoints.length; i++) {
                ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
            }

            ctx.stroke();
        }

        if (screenPoints.length > 0) {
            const last = screenPoints[screenPoints.length - 1];

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#141414";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function drawHud() {
        const groundSpeedKnots = length(boat.velocity) * MS_TO_KNOT;
        const routeAngleDeg = normalizeAngleDeg(boat.headingAngle * 180.0 / Math.PI);
        const wakeLengthM = interpolatedWakeLength(boat.targetSpeedKnots);

        const smallScreen = WIDTH < 600;

        const texts = smallScreen
            ? [
                `${T.target_speed}: ${boat.targetSpeedKnots.toFixed(2)} kn`,
                `${T.real_speed}: ${groundSpeedKnots.toFixed(2)} kn`,
                `${T.boat_heading}: ${routeAngleDeg >= 0 ? "+" : ""}${routeAngleDeg.toFixed(1)}°`,
                `${T.wake_length}: ${wakeLengthM.toFixed(1)} m`,
                `${T.current}: ${config.currentSpeedKnots >= 0 ? "+" : ""}${config.currentSpeedKnots.toFixed(2)} kn @ ${config.currentDirectionDeg >= 0 ? "+" : ""}${config.currentDirectionDeg.toFixed(0)}°`,
            ]
            : [
                `${T.target_speed}: ${boat.targetSpeedKnots.toFixed(2)} ${APP_LANG === "it" ? "nodi" : "knots"}`,
                `${T.real_speed}: ${groundSpeedKnots.toFixed(2)} ${APP_LANG === "it" ? "nodi" : "knots"}`,
                `${T.boat_heading}: ${routeAngleDeg >= 0 ? "+" : ""}${routeAngleDeg.toFixed(1)}°`,
                `${T.wake_length}: ${wakeLengthM.toFixed(1)} m`,
                `${T.current}: ${config.currentSpeedKnots >= 0 ? "+" : ""}${config.currentSpeedKnots.toFixed(2)} ${APP_LANG === "it" ? "nodi" : "knots"} @ ${config.currentDirectionDeg >= 0 ? "+" : ""}${config.currentDirectionDeg.toFixed(0)}°`,
            ];

        ctx.font = smallScreen ? "14px Consolas, monospace" : "18px Consolas, monospace";
        ctx.fillStyle = "white";

        let y = smallScreen ? 20 : 26;
        const step = smallScreen ? 18 : 24;

        for (const text of texts) {
            ctx.fillText(text, 12, y);
            y += step;
        }
    }

    function drawLegend() {
        if (!config || !config.rods || config.rods.length === 0) return;

        const smallScreen = WIDTH < 600;
        const rowHeight = smallScreen ? 18 : 24;
        const boxSize = smallScreen ? 9 : 11;
        const paddingRight = 12;
        const topY = smallScreen ? 20 : 26;

        ctx.font = smallScreen ? "14px Consolas, monospace" : "18px Consolas, monospace";
        ctx.textBaseline = "alphabetic";

        const labels = config.rods.map((rod, i) => {
            return {
                text: `${rod.name}: ${rod.lineLengthM.toFixed(0)} m · ${T.legend_depth} ${rod.trollingDepthM.toFixed(1)} m`,
                color: colors[i % colors.length],
            };
        });

        let maxTextWidth = 0;

        labels.forEach(item => {
            maxTextWidth = Math.max(maxTextWidth, ctx.measureText(item.text).width);
        });

        const totalWidth = boxSize + 8 + maxTextWidth;
        const x = WIDTH - totalWidth - paddingRight;

        labels.forEach((item, i) => {
            const y = topY + i * rowHeight;

            ctx.fillStyle = item.color;
            ctx.fillRect(x, y - boxSize + 2, boxSize, boxSize);

            ctx.strokeStyle = "#141414";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y - boxSize + 2, boxSize, boxSize);

            ctx.fillStyle = "white";
            ctx.fillText(item.text, x + boxSize + 8, y);
        });
    }

    function animate(now) {
        let dt = (now - lastTime) / 1000.0;
        lastTime = now;

        dt = Math.min(dt, 0.03);

        if (boat && config) {
            const curr = currentVector(config, boat.heading());

            boat.update(dt, curr);

            lines.forEach(line => {
                line.update(
                    dt,
                    boat.position,
                    boat.heading(),
                    boat.velocity,
                    curr
                );
            });

            updateWorldScaleFromScene();

            const camera = getSmartCamera();

            ctx.fillStyle = "#14466a";
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            drawGrid(camera);
            drawEngineWake(camera);

            lines.forEach((line, i) => {
                drawLine(line, camera, colors[i % colors.length]);
            });

            drawBoat(camera);
            drawRods(camera);
            drawHud();
            drawLegend();
            drawLineCrossingIndicators(camera);
        }

        requestAnimationFrame(animate);
    }

    function setTouchControl(name, value, button) {
        touchControls[name] = value;

        if (value) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    }

    function bindHoldButton(buttonId, controlName) {
        const button = document.getElementById(buttonId);

        const start = event => {
            event.preventDefault();
            setTouchControl(controlName, true, button);
            canvas.focus();
        };

        const end = event => {
            event.preventDefault();
            setTouchControl(controlName, false, button);
        };

        button.addEventListener("pointerdown", start);
        button.addEventListener("pointerup", end);
        button.addEventListener("pointercancel", end);
        button.addEventListener("pointerleave", end);
    }

    bindHoldButton("btnForward", "up");
    bindHoldButton("btnSlow", "down");
    bindHoldButton("btnLeft", "left");
    bindHoldButton("btnRight", "right");

    window.addEventListener("keydown", event => {
        keys[event.key] = true;

        if (
            event.key === "ArrowUp" ||
            event.key === "ArrowDown" ||
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight"
        ) {
            event.preventDefault();
        }
    });

    window.addEventListener("keyup", event => {
        keys[event.key] = false;
    });

    canvas.addEventListener("click", () => {
        canvas.focus();
    });

    canvas.addEventListener("touchstart", () => {
        canvas.focus();
    }, {passive: true});

    window.addEventListener("resize", () => {
        resizeCanvas();
    });

    resizeCanvas();
    initialiseRods();
    requestAnimationFrame(animate);
