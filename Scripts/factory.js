/* Minimal Factory helpers: calcGen3Matchup and filterHardSets */
(function (global) {
    // ensure core data globals exist
    if (typeof global.typeChart === 'undefined') {
        if (typeof TYPE_CHART_GSC !== 'undefined') global.typeChart = TYPE_CHART_GSC;
        else if (typeof TYPE_CHART_RBY !== 'undefined') global.typeChart = TYPE_CHART_RBY;
    }
    if (typeof global.moves === 'undefined') {
        if (typeof MOVES_ADV !== 'undefined') global.moves = MOVES_ADV;
        else if (typeof MOVES_GSC !== 'undefined') global.moves = MOVES_GSC;
    }
    if (typeof global.mode === 'undefined') {
        // damage_gen3.js checks this for 1vAll mass calc; default to singles
        global.mode = "singles";
    }

    // minimal helpers for damage_gen3.js when full calc helpers are not present
    if (typeof global.checkAirLock === 'undefined') global.checkAirLock = function () {};
    if (typeof global.checkForecast === 'undefined') global.checkForecast = function () {};
    if (typeof global.checkIntimidate === 'undefined') global.checkIntimidate = function () {};
    if (typeof global.getFinalSpeed === 'undefined') {
        global.getFinalSpeed = function (attacker) { return attacker.rawStats && attacker.rawStats.sp ? attacker.rawStats.sp : 0; };
    }
    if (typeof global.getDescriptionPokemonName === 'undefined') {
        global.getDescriptionPokemonName = function (p) { return p.name || 'Unknown'; };
    }
    if (typeof global.buildDescription === 'undefined') {
        global.buildDescription = function () { return ''; };
    }
    if (typeof global.getSingletonDamage === 'undefined') {
        global.getSingletonDamage = function (attacker, defender, move) {
            if (!move || !move.name) return 0;
            if (move.name === 'Seismic Toss' || move.name === 'Night Shade') return attacker.level || 50;
            if (move.name === 'Dragon Rage') return 40;
            if (move.name === 'Sonic Boom') return 20;
            return 0;
        };
    }
    if (typeof global.getTripleKickDamage === 'undefined') global.getTripleKickDamage = function () { return null; };
    if (typeof global.getModifiedStat === 'undefined') {
        global.getModifiedStat = function (stat, stage) {
            if (stage === 0) return stat;
            var num = stage > 0 ? (2 + stage) : 2;
            var den = stage > 0 ? 2 : (2 - stage);
            return Math.floor(stat * num / den);
        };
    }
    if (typeof global.isGrounded === 'undefined') {
        global.isGrounded = function (poke) {
            if (!poke) return true;
            if (poke.hasType && poke.hasType('Flying')) return false;
            if (poke.ability === 'Levitate') return false;
            return true;
        };
    }
    if (typeof global.getMoveEffectiveness === 'undefined') {
        global.getMoveEffectiveness = function (move, moveType, defType) {
            if (!moveType || !defType || !global.typeChart || !global.typeChart[moveType]) return 1;
            var eff = global.typeChart[moveType][defType];
            return typeof eff === 'number' ? eff : 1;
        };
    }
    if (typeof global.killsShedinja === 'undefined') {
        global.killsShedinja = function (attacker, defender, move) {
            // Shedinja with Wonder Guard: only super-effective moves hit
            // This function should NOT bypass Wonder Guard — return false for Shedinja
            // and let the normal type-effectiveness + Wonder Guard check handle it
            return false;
        };
    }
    if (typeof global.toSmogonStat === 'undefined') {
        global.toSmogonStat = function (stat) { return stat.toUpperCase(); };
    }
    if (typeof global.getWeatherBall === 'undefined') {
        global.getWeatherBall = function (weather) {
            if (weather === 'Sun') return 'Fire';
            if (weather === 'Rain') return 'Water';
            if (weather === 'Sand') return 'Rock';
            if (weather === 'Hail') return 'Ice';
            return 'Normal';
        };
    }
    function defaultField(opts) {
        // minimal Field object expected by damage engine
        opts = opts || {};
        return {
            weather: opts.weather || '',
            isReflect: !!opts.isReflect,
            isLightScreen: !!opts.isLightScreen,
            format: opts.format || 'singles',
            isCharge: false,
            isHelpingHand: false,
            getWeather: function () { return this.weather; },
            getSide: function (idx) {
                // side object used by getDamageResultADV; includes weather
                return {weather: this.weather, isReflect: this.isReflect, isLightScreen: this.isLightScreen, format: this.format};
            }
        };
    }

    function statCalc(base, iv, ev, level, isHP, natureMult) {
        if (isHP) {
            if (base === 1) return 1;
            return Math.floor((base * 2 + iv + Math.floor(ev / 4)) * level / 100) + level + 10;
        }
        return Math.floor((Math.floor((base * 2 + iv + Math.floor(ev / 4)) * level / 100) + 5) * natureMult);
    }

    function getNatureMult(nature, statName) {
        if (!NATURES || !(nature in NATURES)) return 1;
        var inc = NATURES[nature][0];
        var dec = NATURES[nature][1];
        if (inc === statName) return 1.1;
        if (dec === statName) return 0.9;
        return 1;
    }

    function normalizeMove(moveName) {
        if (!moveName || moveName === "") return null;
        var mvGlobal = (typeof moves !== 'undefined') ? moves : (typeof MOVES_ADV !== 'undefined' ? MOVES_ADV : (typeof MOVES_GSC !== 'undefined' ? MOVES_GSC : {}));
        if (moveName in mvGlobal) {
            return Object.assign({}, mvGlobal[moveName], {name: moveName});
        }
        return {name: moveName, bp: 0, type: 'None', category: 'Physical', hits: 1};
    }

    function buildPoke(input) {
        // input: {species, level, item, ability, nature, evs, ivs, moves, weight}
        var species = input.species || input.name;
        var level = input.level || 50;
        // try to find a pokedex entry from available globals
        var globalDex = (typeof pokedex !== 'undefined') ? pokedex : (typeof POKEDEX_ADV !== 'undefined' ? POKEDEX_ADV : (typeof POKEDEX_GSC !== 'undefined' ? POKEDEX_GSC : (typeof POKEDEX_RBY !== 'undefined' ? POKEDEX_RBY : null)));
        var dex = (globalDex && globalDex[species]) ? globalDex[species] : null;
        var base = dex && dex.bs ? dex.bs : {hp:1,at:1,df:1,sa:1,sd:1,sp:1};
        var evs = Object.assign({hp:0,at:0,df:0,sa:0,sd:0,sp:0}, input.evs || {});
        var ivs = Object.assign({hp:31,at:31,df:31,sa:31,sd:31,sp:31}, input.ivs || {});
        var nature = input.nature || 'Hardy';

        var poke = {
            name: species,
            level: level,
            item: input.item || '',
            ability: input.ability || '',
            curAbility: input.ability || '',
            resetCurAbility: function () { this.curAbility = this.ability; },
            nature: nature,
            evs: {},
            ivs: {},
            rawStats: {},
            stats: {},
            boosts: {},
            moves: [],
            type1: dex && dex.t1 ? dex.t1 : '',
            type2: dex && dex.t2 ? dex.t2 : '',
            HPEVs: evs.hp || 0,
            maxHP: 1,
            curHP: 1,
            weight: input.weight || (dex && dex.w ? dex.w : 1),
            status: input.status || 'Healthy',
            baseStats: base,
            hasType: function (t) { return (dex && (dex.t1 === t || dex.t2 === t)); }
        };

        // fill evs/ivs
        ['hp','at','df','sa','sd','sp'].forEach(function (s) {
            poke.evs[s] = evs[s] || 0;
            poke.ivs[s] = ivs[s] || 31;
            poke.boosts[s] = (input.boosts && input.boosts[s]) ? input.boosts[s] : 0;
        });

        // compute rawStats and maxHP
        poke.maxHP = statCalc(base.hp, poke.ivs.hp, poke.evs.hp, poke.level, true, 1);
        poke.curHP = input.curHP || poke.maxHP;
        ['at','df','sa','sd','sp'].forEach(function (s) {
            var natureMult = getNatureMult(poke.nature, s);
            poke.rawStats[s] = statCalc(base[s], poke.ivs[s], poke.evs[s], poke.level, false, natureMult);
            poke.stats[s] = poke.rawStats[s];
        });
        // moves
        (input.moves || []).forEach(function (m) {
            var mObj = normalizeMove(m);
            if (mObj) poke.moves.push(mObj);
        });

        return poke;
    }

    function calcGen3Matchup(attacker, defender, options) {
        options = options || {};
        var moveName = options.move; // if provided, only evaluate this move
        var field = options.field || defaultField();

        var atk = (typeof attacker.name === 'string' && typeof attacker.rawStats === 'object') ? attacker : buildPoke(attacker);
        var def = (typeof defender.name === 'string' && typeof defender.rawStats === 'object') ? defender : buildPoke(defender);

        // ensure moves array length 4
        for (var i = 0; i < 4; i++) { if (!atk.moves[i]) atk.moves[i] = {name: '(No Move)', bp:0, type:'None', hits:1}; }

        // call damage engine per move
        var results = [];
        try {
            var raw = CALCULATE_MOVES_OF_ATTACKER_ADV(atk, def, field);
            for (var i = 0; i < raw.length; i++) {
                var entry = raw[i];
                if (!entry) continue;
                var damageArr = entry.damage || [];
                var min = Math.min.apply(null, damageArr);
                var max = Math.max.apply(null, damageArr);
                var guaranteedKO = (min >= def.maxHP);
                var possibleKO = (max >= def.maxHP);
                results.push({move: atk.moves[i].name, minDamage: min, maxDamage: max, minPercent: Math.round(100*min/def.maxHP), maxPercent: Math.round(100*max/def.maxHP), guaranteedKO: guaranteedKO, possibleKO: possibleKO, raw: entry});
            }
        } catch (e) {
            return {error: 'damage engine error: ' + e.message, perMove: []};
        }

        // filter by moveName if requested
        if (moveName) results = results.filter(r => r.move === moveName);

        // compute final speed values if damage engine set them
        var spKey = (typeof SP !== 'undefined') ? SP : 'sp';
        var attackerSpeed = atk.stats && atk.stats[spKey] ? atk.stats[spKey] : atk.rawStats && atk.rawStats[spKey] ? atk.rawStats[spKey] : atk.stats && atk.stats['sp'];
        var defenderSpeed = def.stats && def.stats[spKey] ? def.stats[spKey] : def.rawStats && def.rawStats[spKey] ? def.rawStats[spKey] : def.stats && def.stats['sp'];

        // summary metrics
        var worst = results.reduce(function (acc, r) { if (!acc || r.minPercent > acc.minPercent) return r; return acc; }, null);
        return {attacker: atk, defender: def, perMove: results, hardestMove: worst, attackerSpeed: attackerSpeed, defenderSpeed: defenderSpeed};
    }

    function evaluateAllSets(attackerInput, options) {
        options = options || {};
        var field = options.field || defaultField();
        var atk = (typeof attackerInput.name === 'string' && typeof attackerInput.rawStats === 'object') ? attackerInput : buildPoke(attackerInput);

        var results = [];
        if (typeof SETDEX_EM === 'undefined') return results;
        var speciesList = Object.keys(SETDEX_EM);
        var limit = options.limit || speciesList.length * 1000; // large default
        var pushed = 0;
        for (var si = 0; si < speciesList.length; si++) {
            var species = speciesList[si];
            var sets = SETDEX_EM[species];
            var setNames = Object.keys(sets);
            for (var sj = 0; sj < setNames.length; sj++) {
                var setName = setNames[sj];
                var setObj = sets[setName];
                if (pushed >= limit) break;
                var defLevel = (typeof options.opponentLevel !== 'undefined' && options.opponentLevel !== null) ? options.opponentLevel : 50;
                var defInput = Object.assign({species: species, level: defLevel}, setObj);
                // if set doesn't specify ability, look it up from the pokedex
                if (!defInput.ability) {
                    var gdx1 = (typeof pokedex !== 'undefined') ? pokedex : (typeof POKEDEX_ADV !== 'undefined' ? POKEDEX_ADV : null);
                    var dxEntry1 = gdx1 && gdx1[species] ? gdx1[species] : null;
                    var abils1 = dxEntry1 && dxEntry1.abilities ? dxEntry1.abilities : [];
                    if (abils1.length === 1) defInput.ability = abils1[0];
                }
                var def = buildPoke(defInput);
                // run attacker -> defender
                var forward = calcGen3Matchup(atk, def, {field: field});
                // run defender -> attacker to see threat
                var reverse = calcGen3Matchup(def, atk, {field: field});
                var defMaxPercent = 0;
                var defMinPercent = 0;
                var defBestMove = '';
                var defBestMin = 0;
                var defBestMax = 0;
                if (reverse && Array.isArray(reverse.perMove)) {
                    reverse.perMove.forEach(function (m) {
                        if (m.maxPercent >= defMaxPercent) {
                            defMaxPercent = m.maxPercent;
                            defMinPercent = m.minPercent;
                            defBestMove = m.move;
                            defBestMin = m.minPercent;
                            defBestMax = m.maxPercent;
                        }
                    });
                }

                var atkMax = 0;
                var atkMin = 0;
                var atkGuaranteedKO = false;
                var atkBestMove = '';
                var atkBestMin = 0;
                var atkBestMax = 0;
                if (forward && Array.isArray(forward.perMove)) {
                    forward.perMove.forEach(function (m) {
                        if (m.maxPercent >= atkMax) {
                            atkMax = m.maxPercent || 0;
                            atkMin = m.minPercent || 0;
                            atkBestMove = m.move;
                            atkBestMin = m.minPercent || 0;
                            atkBestMax = m.maxPercent || 0;
                        }
                        if (m.guaranteedKO) atkGuaranteedKO = true;
                    });
                } else {
                    // damage engine may have errored; leave defaults
                    atkMax = 0;
                    atkMin = 0;
                    atkGuaranteedKO = false;
                }

                var outspeeds = (forward.attackerSpeed && forward.defenderSpeed) ? (forward.attackerSpeed > forward.defenderSpeed) : (atk.rawStats && def.rawStats ? (atk.rawStats.sp > def.rawStats.sp) : false);

                // scoring: higher = worse for attacker
                var score = defMaxPercent - atkMax + (outspeeds ? -40 : 0) + (atkGuaranteedKO ? -200 : 0);

                results.push({
                    species: species,
                    setName: setName,
                    set: setObj,
                    forward: forward,
                    reverse: reverse,
                    error: forward && forward.error ? forward.error : (reverse && reverse.error ? reverse.error : ''),
                    defenderThreatPercent: defMaxPercent,
                    defenderMinPercent: defMinPercent,
                    defenderBestMove: defBestMove,
                    defenderBestMin: defBestMin,
                    defenderBestMax: defBestMax,
                    attackerMaxPercent: atkMax,
                    attackerMinPercent: atkMin,
                    attackerBestMove: atkBestMove,
                    attackerBestMin: atkBestMin,
                    attackerBestMax: atkBestMax,
                    attackerGuaranteedKO: atkGuaranteedKO,
                    outspeeds: outspeeds,
                    score: score
                });
                pushed++;
            }
            if (pushed >= limit) break;
        }

        // sort worst -> best (descending score)
        results.sort(function (a,b) { return b.score - a.score; });
        return results;
    }

    global.evaluateAllSets = evaluateAllSets;

    /* evaluate every set against an entire team (array of attacker inputs) */
    function evaluateAllSetsTeam(teamInputs, options) {
        options = options || {};
        var field = options.field || defaultField();
        var team = teamInputs.map(function(inp) {
            return (typeof inp.name === 'string' && typeof inp.rawStats === 'object') ? inp : buildPoke(inp);
        });
        var results = [];
        if (typeof SETDEX_EM === 'undefined') return results;
        var speciesList = Object.keys(SETDEX_EM);
        var limit = options.limit || speciesList.length * 1000;
        var pushed = 0;
        for (var si = 0; si < speciesList.length; si++) {
            var species = speciesList[si];
            var sets = SETDEX_EM[species];
            var setNames = Object.keys(sets);
            for (var sj = 0; sj < setNames.length; sj++) {
                if (pushed >= limit) break;
                var setName = setNames[sj];
                var setObj = sets[setName];
                var defLevel = (typeof options.opponentLevel !== 'undefined' && options.opponentLevel !== null) ? options.opponentLevel : 50;
                var defInput = Object.assign({species: species, level: defLevel}, setObj);
                // if set doesn't specify ability, look it up from the pokedex
                if (!defInput.ability) {
                    var gdx2 = (typeof pokedex !== 'undefined') ? pokedex : (typeof POKEDEX_ADV !== 'undefined' ? POKEDEX_ADV : null);
                    var dxEntry2 = gdx2 && gdx2[species] ? gdx2[species] : null;
                    var abils2 = dxEntry2 && dxEntry2.abilities ? dxEntry2.abilities : [];
                    if (abils2.length === 1) defInput.ability = abils2[0];
                }
                var def = buildPoke(defInput);
                var members = [];
                var fieldForward = options.fieldForward || field;
                var fieldReverse = options.fieldReverse || field;
                for (var ti = 0; ti < team.length; ti++) {
                    var atk = team[ti];
                    var forward = calcGen3Matchup(atk, def, {field: fieldForward});
                    var reverse = calcGen3Matchup(def, atk, {field: fieldReverse});
                    var atkBestMove = '', atkBestMin = 0, atkBestMax = 0, atkGKO = false;
                    if (forward && Array.isArray(forward.perMove)) {
                        forward.perMove.forEach(function(m) {
                            if (m.maxPercent >= atkBestMax) { atkBestMax = m.maxPercent||0; atkBestMin = m.minPercent||0; atkBestMove = m.move; }
                            if (m.guaranteedKO) atkGKO = true;
                        });
                    }
                    var defBestMove = '', defBestMin = 0, defBestMax = 0;
                    if (reverse && Array.isArray(reverse.perMove)) {
                        reverse.perMove.forEach(function(m) {
                            if (m.maxPercent >= defBestMax) { defBestMax = m.maxPercent; defBestMin = m.minPercent; defBestMove = m.move; }
                        });
                    }
                    var outspeeds = false;
                    var atkSpeed = atk.rawStats ? atk.rawStats.sp : 0;
                    var defSpeed = def.rawStats ? def.rawStats.sp : 0;
                    if (atk.boosts && atk.boosts.sp) atkSpeed = getModifiedStat(atkSpeed, atk.boosts.sp);
                    if (def.boosts && def.boosts.sp) defSpeed = getModifiedStat(defSpeed, def.boosts.sp);
                    outspeeds = atkSpeed > defSpeed;
                    var memberScore = defBestMax - atkBestMax + (outspeeds ? -40 : 0) + (atkGKO ? -200 : 0);
                    members.push({
                        attackerBestMove: atkBestMove, attackerBestMin: atkBestMin, attackerBestMax: atkBestMax,
                        attackerGuaranteedKO: atkGKO,
                        defenderBestMove: defBestMove, defenderBestMin: defBestMin, defenderBestMax: defBestMax,
                        outspeeds: outspeeds, score: memberScore
                    });
                }
                var bestScore = Math.min.apply(null, members.map(function(m){ return m.score; }));
                results.push({ species: species, setName: setName, set: setObj, members: members, score: bestScore });
                pushed++;
            }
            if (pushed >= limit) break;
        }
        results.sort(function(a,b) { return b.score - a.score; });
        return results;
    }
    global.evaluateAllSetsTeam = evaluateAllSetsTeam;

    function filterHardSets(filterFn) {
        filterFn = filterFn || function (species, setName, setObj) {
            var key = setName + '';
            var lower = key.toLowerCase();
            if (lower.includes('silver') || lower.includes('gold') || lower.includes('greta')) return true;
            if (setObj && setObj.tier) return true;
            return false;
        };
        var out = [];
        if (typeof SETDEX_EM === 'undefined') return out;
        Object.keys(SETDEX_EM).forEach(function (species) {
            var sets = SETDEX_EM[species];
            Object.keys(sets).forEach(function (setName) {
                var setObj = sets[setName];
                if (filterFn(species, setName, setObj)) {
                    out.push({species: species, setName: setName, set: setObj});
                }
            });
        });
        return out;
    }

    // ---------- Group 1 & 2 pokemon pools (added) ----------
    var GROUP1 = [
        "Butterfree","Beedrill","Pidgeotto","Grimer","Tentacool","Poliwhirl","Onix","Krabby","Drowzee","Voltorb",
        "Exeggcute","Koffing","Staryu","Eevee","Omanyte","Kabuto","Chinchou","Ledian","Ariados","Yanma",
        "Aipom","Unown","Teddiursa","Delibird","Houndour","Phanpy","Elekid","Magby","Corsola","Skiploom",
        "Nuzleaf","Lombre","Spinda","Aron","Mawile","Cacnea","Vibrava","Lileep","Anorith","Clamperl",
        "Luvdisc","Spoink","Nosepass","Flaaffy","Rhyhorn","Growlithe","Nidorina","Nidorino","Loudred","Beautifly",
        "Dustox"
    ];

    var GROUP2 = [
        "Ivysaur","Charmeleon","Wartortle","Gloom","Weepinbell","Kadabra","Parasect","Arbok","Sandslash","Golbat",
        "Haunter","Lickitung","Raticate","Pidgeot","Porygon","Omastar","Kabutops","Cloyster","Poliwrath","Bayleef",
        "Quilava","Croconaw","Togetic","Sunflora","Jumpluff","Dunsparce","Murkrow","Wobbuffet","Girafarig","Gligar",
        "Qwilfish","Sneasel","Hitmonlee","Hitmonchan","Hitmontop","Scyther","Pinsir","Politoed","Seaking","Chansey",
        "Mantine","Stantler","Mightyena","Linoone","Vigoroth","Masquerain","Delcatty","Sableye","Plusle","Minun",
        "Roselia","Swalot","Grovyle","Combusken","Marshtomp","Lairon","Volbeat","Illumise","Wailmer",
        "Camerupt","Torkoal","Cacturne","Grumpig","Lunatone","Solrock","Sharpedo","Crawdaunt","Tropius",
        "Chimecho","Absol","Pupitar","Shelgon","Metang","Sealeo","Huntail","Gorebyss","Relicanth"
    ];

    // ---------- Group 3 pokemon pool ----------
    var GROUP3 = [
        "Aerodactyl","Aggron","Alakazam","Altaria","Ampharos","Arcanine","Armaldo",
        "Articuno","Blastoise","Blaziken","Blissey","Breloom","Charizard","Claydol",
        "Clefable","Cradily","Crobat","Dewgong","Dodrio","Donphan","Dragonite","Dugtrio",
        "Dusclops","Electabuzz","Electrode","Entei","Espeon","Exeggutor","Exploud",
        "Fearow","Feraligatr","Flareon","Flygon","Forretress","Gardevoir","Gengar",
        "Glalie","Golduck","Golem","Granbull","Gyarados","Hariyama","Heracross",
        "Houndoom","Hypno","Jolteon","Jynx","Kangaskhan","Kingdra","Lanturn","Lapras",
        "Latias","Latios","Ludicolo","Machamp","Magmar","Manectric","Marowak","Medicham",
        "Meganium","Metagross","Milotic","Miltank","Misdreavus","Moltres","Mr. Mime",
        "Muk","Nidoking","Nidoqueen","Ninetales","Porygon2","Quagsire","Raichu","Raikou",
        "Rapidash","Regice","Regirock","Registeel","Rhydon","Salamence","Sceptile",
        "Scizor","Shiftry","Shuckle","Skarmory","Slaking","Slowbro","Slowking","Snorlax",
        "Starmie","Steelix","Suicune","Swampert","Tauros","Tentacruel","Typhlosion",
        "Tyranitar","Umbreon","Ursaring","Vaporeon","Venusaur","Victreebel","Vileplume",
        "Wailord","Walrein","Weezing","Whiscash","Xatu","Zapdos"
    ];

    // expose
    global.GROUP1 = GROUP1;
    global.GROUP2 = GROUP2;
    global.GROUP3 = GROUP3;
    global.calcGen3Matchup = calcGen3Matchup;
    global.defaultField = defaultField;
    global.filterHardSets = filterHardSets;
    // expose builder for UI use
    global.buildPoke = buildPoke;
})(this);
