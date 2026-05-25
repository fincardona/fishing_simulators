const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const simulatorPath = path.join(__dirname, "..", "assets", "simulator.js");
const simulatorSource = fs.readFileSync(simulatorPath, "utf8");

function createCanvasContext() {
    const noop = () => {};

    return {
        setTransform: noop,
        fillRect: noop,
        clearRect: noop,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        arcTo: noop,
        closePath: noop,
        stroke: noop,
        fill: noop,
        arc: noop,
        fillText: noop,
        save: noop,
        restore: noop,
        measureText: text => ({width: String(text).length * 8}),
        createLinearGradient: () => ({addColorStop: noop}),
    };
}

function loadSimulator() {
    const elements = new Map();
    const context2d = createCanvasContext();

    const defaultValues = {
        numRods: "7",
        initialSpeed: "6.0",
        currentSpeed: "0.0",
        currentDirection: "0",
    };

    function makeElement(id) {
        return {
            id,
            value: defaultValues[id] || "",
            innerHTML: "",
            className: "",
            classList: {
                add() {},
                remove() {},
            },
            addEventListener() {},
            appendChild() {},
            focus() {},
            getBoundingClientRect() {
                return {width: 1200, height: 700};
            },
            getContext() {
                return context2d;
            },
        };
    }

    function getElementById(id) {
        if (!elements.has(id)) {
            elements.set(id, makeElement(id));
        }

        return elements.get(id);
    }

    const context = {
        console,
        performance: {
            now: () => 0,
        },
        requestAnimationFrame() {},
        window: {
            APP_LANG: "en",
            devicePixelRatio: 1,
            addEventListener() {},
        },
        document: {
            querySelectorAll: () => [],
            createElement: tagName => makeElement(tagName),
            getElementById,
        },
    };

    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(simulatorSource, context, {filename: simulatorPath});

    return context;
}

function p(x, y) {
    return {x, y};
}

function line(name, points) {
    return {
        config: {
            name,
            trollingDepthM: 0,
        },
        points,
    };
}

function lineANearNoCross() {
    return line("A", [
        p(-2, 0),
        p(-0.8, 0),
        p(-0.4, 0),
        p(-0.35, 0),
    ]);
}

function lineAFarNoCross() {
    return line("A", [
        p(-5, 0),
        p(-4, 0),
        p(-3.5, 0),
        p(-3, 0),
    ]);
}

function lineACrossesB() {
    return line("A", [
        p(-2, 0),
        p(-1, 0),
        p(-0.5, 0),
        p(0.5, 0),
    ]);
}

function lineAForBCrossing() {
    return line("A", [
        p(-2, 0),
        p(-1, 0),
        p(1, 0),
        p(2, 0),
    ]);
}

function verticalLineB() {
    return line("B", [
        p(0, -2),
        p(0, -1),
        p(0, 1),
        p(0, 2),
    ]);
}

function lineBCrossesA() {
    return line("B", [
        p(0, -2),
        p(0, -1),
        p(0, -0.5),
        p(0, 0.5),
    ]);
}

function verticalLineC() {
    return line("C", [
        p(5, -2),
        p(5, -1),
        p(5, 1),
        p(5, 2),
    ]);
}

function lineACrossesC() {
    return line("A", [
        p(3, 0),
        p(4, 0),
        p(4.5, 0),
        p(5.5, 0),
    ]);
}

function evaluate(sim, i, j, lineA, lineB) {
    return sim.evaluateRodPair(i, j, lineA, lineB);
}

function fadeResolvedState(sim) {
    for (let frame = 0; frame < 50; frame++) {
        evaluate(sim, 0, 1, lineAFarNoCross(), verticalLineB());
    }
}

function testApproachWithoutCrossing() {
    const sim = loadSimulator();

    const risk = evaluate(sim, 0, 1, lineANearNoCross(), verticalLineB());

    assert.ok(risk, "near non-crossing endpoint should show a risk slider");
    assert.equal(risk.crossed, false);
    assert.equal(risk.veryClose, false);
    assert.ok(risk.severity > 0 && risk.severity < 1);

    const farRisk = evaluate(sim, 0, 1, lineAFarNoCross(), verticalLineB());
    assert.equal(farRisk, null, "non-crossing pair should not stay locked");
}

function testSingleCrossingLocksAtMax() {
    const sim = loadSimulator();

    const first = evaluate(sim, 0, 1, lineACrossesB(), verticalLineB());
    assert.equal(first.crossed, true);
    assert.equal(first.severity, 1);
    assert.equal(first.forceKnob, true);

    const movedAway = evaluate(sim, 0, 1, lineAFarNoCross(), verticalLineB());
    assert.ok(movedAway, "locked pair should remain visible after moving away");
    assert.equal(movedAway.crossed, true);
    assert.equal(movedAway.severity, 1);
}

function testSecondCrossingUnlocksSameUnorderedPair() {
    const sim = loadSimulator();

    evaluate(sim, 0, 1, lineACrossesB(), verticalLineB());
    evaluate(sim, 0, 1, lineAFarNoCross(), verticalLineB());

    const unlocked = evaluate(sim, 0, 1, lineAForBCrossing(), lineBCrossesA());

    assert.ok(unlocked, "resolved pair should fade instead of disappearing");
    assert.equal(unlocked.crossed, false);
    assert.ok(unlocked.severity > 0.9);
    assert.equal(unlocked.forceKnob, true);

    fadeResolvedState(sim);

    const normalRisk = evaluate(sim, 0, 1, lineANearNoCross(), verticalLineB());
    assert.ok(normalRisk);
    assert.equal(normalRisk.crossed, false);
    assert.ok(normalRisk.severity > 0 && normalRisk.severity < 1);
}

function testProcessRepeatsAfterReset() {
    const sim = loadSimulator();

    evaluate(sim, 0, 1, lineACrossesB(), verticalLineB());
    evaluate(sim, 0, 1, lineAFarNoCross(), verticalLineB());
    evaluate(sim, 0, 1, lineAForBCrossing(), lineBCrossesA());
    fadeResolvedState(sim);

    const lockedAgain = evaluate(sim, 0, 1, lineACrossesB(), verticalLineB());
    assert.equal(lockedAgain.crossed, true);
    assert.equal(lockedAgain.severity, 1);

    evaluate(sim, 0, 1, lineAFarNoCross(), verticalLineB());

    const unlockedAgain = evaluate(sim, 0, 1, lineAForBCrossing(), lineBCrossesA());
    assert.equal(unlockedAgain.crossed, false);
    assert.ok(unlockedAgain.severity > 0.9);
}

function testUnorderedPairProducesOneRisk() {
    const sim = loadSimulator();

    sim.__testLines = [
        lineAForBCrossing(),
        lineBCrossesA(),
    ];

    vm.runInContext("lines = __testLines", sim);
    const risks = vm.runInContext("getLineCrossingRisks()", sim);

    assert.equal(risks.length, 1);
    assert.equal(risks[0].pairKey, "0<->1");
}

function testMultiplePairsRemainIndependent() {
    const sim = loadSimulator();

    const pairAB = evaluate(sim, 0, 1, lineACrossesB(), verticalLineB());
    const pairAC = evaluate(sim, 0, 2, lineACrossesC(), verticalLineC());

    assert.equal(pairAB.crossed, true);
    assert.equal(pairAC.crossed, true);

    evaluate(sim, 0, 1, lineAFarNoCross(), verticalLineB());
    const unlockedAB = evaluate(sim, 0, 1, lineAForBCrossing(), lineBCrossesA());
    assert.equal(unlockedAB.crossed, false);

    const stillLockedAC = evaluate(sim, 0, 2, lineAFarNoCross(), verticalLineC());
    assert.equal(stillLockedAC.crossed, true);
    assert.equal(stillLockedAC.severity, 1);
}

const tests = [
    testApproachWithoutCrossing,
    testSingleCrossingLocksAtMax,
    testSecondCrossingUnlocksSameUnorderedPair,
    testProcessRepeatsAfterReset,
    testUnorderedPairProducesOneRisk,
    testMultiplePairsRemainIndependent,
];

for (const test of tests) {
    test();
    console.log(`PASS ${test.name}`);
}
