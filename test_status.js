// Quick test: verify Guts (Hariyama) and Marvel Scale (Milotic) status effects
// Run: node test_status.js

// minimal DOM stub so shared_calc globals can load
global.window = global;
function deepExtend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (!src) continue;
        for (var k in src) {
            if (src.hasOwnProperty(k)) {
                if (typeof src[k] === 'object' && src[k] !== null && !Array.isArray(src[k])) {
                    target[k] = deepExtend(target[k] || {}, src[k]);
                } else {
                    target[k] = src[k];
                }
            }
        }
    }
    return target;
}
var jqStub = function() {
    var self = { val: function(){return '';}, prop: function(){return false;}, text: function(){return self;}, change: function(){return self;},
        find: function(){ return jqStub(); }, length: 0, keyup: function(){return self;}, on: function(){return self;},
        click: function(){return self;}, is: function(){return false;}, each: function(){return self;},
        append: function(){return self;}, html: function(){return self;}, css: function(){return self;},
        attr: function(){return self;}, addClass: function(){return self;}, removeClass: function(){return self;},
        show: function(){return self;}, hide: function(){return self;}, eq: function(){return jqStub();},
        bind: function(){return self;}, ready: function(fn){return self;}, trigger: function(){return self;},
        data: function(){return '';}, focus: function(){return self;}, blur: function(){return self;},
        select2: function(){return self;}, empty: function(){return self;}, remove: function(){return self;},
        textContent: '', checked: false
    };
    return self;
};
jqStub.extend = function() {
    var deep = false, args = Array.prototype.slice.call(arguments);
    if (typeof args[0] === 'boolean') { deep = args.shift(); }
    if (deep) return deepExtend.apply(null, args);
    return Object.assign.apply(null, args);
};
jqStub.inArray = function(val, arr) { return arr ? arr.indexOf(val) : -1; };
global.$ = jqStub;
global.jQuery = jqStub;
global.document = { getElementById: function(){ return null; } };
global.mode = '';
global.localStorage = { getItem: function(){return null;}, setItem: function(){} };
global.location = { search: '' };

// load data files via vm to run in global scope (like browser script tags)
var fs = require('fs');
var vm = require('vm');
function loadScript(p) { vm.runInThisContext(fs.readFileSync(p, 'utf8'), {filename: p}); }

loadScript('./Scripts/type_data.js');
loadScript('./Scripts/nature_data.js');
loadScript('./Scripts/stat_data.js');
loadScript('./Scripts/move_data.js');
loadScript('./Scripts/item_data.js');
loadScript('./Scripts/pokedex.js');
loadScript('./Scripts/shared_calc.js');
loadScript('./Scripts/damage_gen3.js');
loadScript('./Scripts/factory.js');

var buildPoke = global.buildPoke;
var calcGen3Matchup = global.calcGen3Matchup;
var defaultField = global.defaultField;

// ===== Test 1: Hariyama with Guts =====
console.log('=== Hariyama Guts Test ===');
var hariyamaHealthy = buildPoke({
    species: 'Hariyama', level: 50, nature: 'Adamant', ability: 'Guts',
    evs: {hp:0, at:252, df:0, sa:0, sd:0, sp:0}, ivs: {hp:31,at:31,df:31,sa:31,sd:31,sp:31},
    moves: ['Cross Chop'], status: 'Healthy'
});
var hariyamaBurned = buildPoke({
    species: 'Hariyama', level: 50, nature: 'Adamant', ability: 'Guts',
    evs: {hp:0, at:252, df:0, sa:0, sd:0, sp:0}, ivs: {hp:31,at:31,df:31,sa:31,sd:31,sp:31},
    moves: ['Cross Chop'], status: 'Burned'
});

var target = buildPoke({
    species: 'Snorlax', level: 50, nature: 'Careful',
    evs: {hp:252, at:0, df:252, sa:0, sd:0, sp:0}, ivs: {hp:31,at:31,df:31,sa:31,sd:31,sp:31},
    moves: ['Body Slam'], status: 'Healthy'
});

var field = defaultField();
var resHealthy = calcGen3Matchup(hariyamaHealthy, target, {field: field});
var resBurned = calcGen3Matchup(hariyamaBurned, target, {field: field});

var healthyMax = 0, burnedMax = 0;
resHealthy.perMove.forEach(function(m) { if (m.move === 'Cross Chop') healthyMax = m.maxPercent; });
resBurned.perMove.forEach(function(m) { if (m.move === 'Cross Chop') burnedMax = m.maxPercent; });

console.log('Healthy Cross Chop max%:', healthyMax);
console.log('Burned+Guts Cross Chop max%:', burnedMax);
console.log('Guts boost working:', burnedMax > healthyMax ? 'YES (burned does MORE damage with Guts)' : 'NO — burned should do more!');

// ===== Test 2: Milotic Marvel Scale =====
console.log('\n=== Milotic Marvel Scale Test ===');
var miloticHealthy = buildPoke({
    species: 'Milotic', level: 50, nature: 'Bold', ability: 'Marvel Scale',
    evs: {hp:252, at:0, df:252, sa:0, sd:0, sp:0}, ivs: {hp:31,at:31,df:31,sa:31,sd:31,sp:31},
    moves: ['Surf'], status: 'Healthy'
});
var miloticBurned = buildPoke({
    species: 'Milotic', level: 50, nature: 'Bold', ability: 'Marvel Scale',
    evs: {hp:252, at:0, df:252, sa:0, sd:0, sp:0}, ivs: {hp:31,at:31,df:31,sa:31,sd:31,sp:31},
    moves: ['Surf'], status: 'Burned'
});

var physAttacker = buildPoke({
    species: 'Machamp', level: 50, nature: 'Adamant', ability: 'Guts',
    evs: {hp:0, at:252, df:0, sa:0, sd:0, sp:0}, ivs: {hp:31,at:31,df:31,sa:31,sd:31,sp:31},
    moves: ['Cross Chop'], status: 'Healthy'
});

var resMiloticHealthy = calcGen3Matchup(physAttacker, miloticHealthy, {field: field});
var resMiloticBurned = calcGen3Matchup(physAttacker, miloticBurned, {field: field});

var dmgHealthy = 0, dmgBurned = 0;
resMiloticHealthy.perMove.forEach(function(m) { if (m.move === 'Cross Chop') dmgHealthy = m.maxPercent; });
resMiloticBurned.perMove.forEach(function(m) { if (m.move === 'Cross Chop') dmgBurned = m.maxPercent; });

console.log('Cross Chop vs Milotic (healthy) max%:', dmgHealthy);
console.log('Cross Chop vs Milotic (burned+Marvel Scale) max%:', dmgBurned);
console.log('Marvel Scale working:', dmgBurned < dmgHealthy ? 'YES (statused Milotic takes LESS phys damage)' : 'NO — should take less!');

// ===== Test 3: Weather =====
console.log('\n=== Weather Test ===');
var fireUser = buildPoke({
    species: 'Charizard', level: 50, nature: 'Modest', ability: 'Blaze',
    evs: {hp:0, at:0, df:0, sa:252, sd:0, sp:252}, moves: ['Flamethrower'], status: 'Healthy'
});
var waterTarget = buildPoke({
    species: 'Snorlax', level: 50, nature: 'Careful',
    evs: {hp:252, at:0, df:0, sa:0, sd:252, sp:0}, moves: ['Body Slam'], status: 'Healthy'
});

var fieldNone = defaultField();
var fieldSun = defaultField({weather: 'Sun'});
var fieldRain = defaultField({weather: 'Rain'});

var resNone = calcGen3Matchup(fireUser, waterTarget, {field: fieldNone});
var resSun = calcGen3Matchup(fireUser, waterTarget, {field: fieldSun});
var resRain = calcGen3Matchup(fireUser, waterTarget, {field: fieldRain});

var noneMax = 0, sunMax = 0, rainMax = 0;
resNone.perMove.forEach(function(m) { if (m.move === 'Flamethrower') noneMax = m.maxPercent; });
resSun.perMove.forEach(function(m) { if (m.move === 'Flamethrower') sunMax = m.maxPercent; });
resRain.perMove.forEach(function(m) { if (m.move === 'Flamethrower') rainMax = m.maxPercent; });

console.log('Flamethrower (no weather):', noneMax + '%');
console.log('Flamethrower (Sun):', sunMax + '%');
console.log('Flamethrower (Rain):', rainMax + '%');
console.log('Sun boosts fire:', sunMax > noneMax ? 'YES' : 'NO');
console.log('Rain weakens fire:', rainMax < noneMax ? 'YES' : 'NO');

// ===== Test 4: Reflect/Light Screen =====
console.log('\n=== Reflect / Light Screen Test ===');
var fieldReflect = defaultField({isReflect: true});
var fieldScreen = defaultField({isLightScreen: true});

var physRes = calcGen3Matchup(physAttacker, miloticHealthy, {field: fieldReflect});
var physResNoRef = calcGen3Matchup(physAttacker, miloticHealthy, {field: fieldNone});
var physRefMax = 0, physNoRefMax = 0;
physRes.perMove.forEach(function(m) { if (m.move === 'Cross Chop') physRefMax = m.maxPercent; });
physResNoRef.perMove.forEach(function(m) { if (m.move === 'Cross Chop') physNoRefMax = m.maxPercent; });

console.log('Cross Chop vs Milotic (no Reflect):', physNoRefMax + '%');
console.log('Cross Chop vs Milotic (with Reflect):', physRefMax + '%');
console.log('Reflect halves phys:', physRefMax < physNoRefMax ? 'YES' : 'NO');

var specRes = calcGen3Matchup(fireUser, waterTarget, {field: fieldScreen});
var specNoScr = calcGen3Matchup(fireUser, waterTarget, {field: fieldNone});
var specScrMax = 0, specNoScrMax = 0;
specRes.perMove.forEach(function(m) { if (m.move === 'Flamethrower') specScrMax = m.maxPercent; });
specNoScr.perMove.forEach(function(m) { if (m.move === 'Flamethrower') specNoScrMax = m.maxPercent; });

console.log('Flamethrower (no Light Screen):', specNoScrMax + '%');
console.log('Flamethrower (with Light Screen):', specScrMax + '%');
console.log('Light Screen halves special:', specScrMax < specNoScrMax ? 'YES' : 'NO');

console.log('\n=== All tests done ===');
