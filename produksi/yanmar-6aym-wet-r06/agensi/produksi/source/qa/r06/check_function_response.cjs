const assert = require('node:assert/strict');
const { create } = require('../../model/motion/functional-motion.js');
const fs = require('node:fs');
const path = require('node:path');
const controller = create();
const read = (actuation, fields={}) => controller.sample({actuation, ...fields});
let crankRadians = 0, starterRadians = 0;
function step(phase, seconds, rpm, engagement) {
  const steps = Math.ceil(seconds * 100);
  const dt = seconds / steps;
  for (let i = 0; i < steps; i++) {
    crankRadians += rpm * Math.PI / 30 * dt;
    if (phase === 'cranking') starterRadians += rpm * Math.PI / 30 * dt;
    controller.tick({phase, dt, rpm, crankRadians, starterRadians, engagement});
  }
  return controller.inspect();
}
const thermal = (opens_c, full_open_c) => -read('thermostat', {opens_c,full_open_c}).travel;
assert.equal(thermal(71, 85), 0);
step('engaging', .35, 0, 1);
const cranking = step('cranking', 1.45, 150, 1);
assert.equal(cranking.pinion, cranking.armature);
assert.equal(cranking.fuel, 1);
assert.equal(cranking.turboRate, 0);
assert.equal(thermal(71, 85), 0);
const firing = step('firing', .85, 480, 1);
assert(firing.pinion > firing.armature);
assert(Math.abs((firing.pinion - cranking.pinion) - (firing.crank - cranking.crank)) < 1e-8);
assert(firing.turboRate > 0);
step('running', .24, 650, .2);
const warm = step('running', 165, 650, 0);
assert.equal(thermal(71, 85), .008);
const typeB = thermal(76.5, 90);
assert(typeB > 0 && typeB < .008);
assert(warm.rack < cranking.rack);
assert(Math.abs(read('fuel-rack').travel / .0175 - read('fuel-metering').angle) < 1e-10);
assert.equal(warm.clutch, 'lepas');
const coast = step('stopping', 1.05, 150, 0);
assert.equal(read('injection').scaleStroke, 0);
assert(coast.rack < 1e-8 && coast.crank > warm.crank);
const off = step('off', 4, 0, 0);
assert.equal(controller.coasting(), false);
assert.equal(off.crank, coast.crank);
controller.setCapTest(0);
assert.equal(read('cap-pressure').travel, 0);
controller.setCapTest(120);
assert.equal(read('cap-pressure').travel, .003);
controller.setCapTest(-4);
assert.equal(read('cap-return').travel, -.0012);
controller.reset();
assert.equal(controller.inspect().tempC, 30);
const result = {cold_thermostat_lift_mm:0, warm_after_165_seconds_C:warm.tempC,
  typeA_lift_mm:8,typeB_lift_mm:typeB*1000,starter_locked_during_crank:true,
  pinion_continued_with_firing_flywheel:true,starter_motor_overrun:true,
  injection_cut_while_crank_coasts:true, four_seconds_off_all_free_angular_rates_zero:true,
  pressure_cap_demo_120_kPa_lift_mm:3, vacuum_demo_minus4kPa_lowering_mm:1.2};
fs.writeFileSync(path.join(__dirname, 'controller-response.json'), JSON.stringify(result, null, 2)+'\n');
console.log(result);
