#!/usr/bin/env node
/**
 * build_learnsets.js
 * Parses the four .h data files under /Data and generates Scripts/learnsets.js
 * which maps each species display name to an array of learnable move display names.
 *
 * Usage:  node build_learnsets.js
 */

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'Data');
const OUT  = path.join(__dirname, 'Scripts', 'learnsets.js');

// ── Move name overrides: MOVE_XXX key (after stripping MOVE_ prefix) → display name
const MOVE_OVERRIDES = {
    'FAINT_ATTACK':    'Feint Attack',
    'SELF_DESTRUCT':   'Self-Destruct',
    'SELFDESTRUCT':    'Self-Destruct',
    'SMELLING_SALT':   'Smelling Salts',
    'SMELLING_SALTS':  'Smelling Salts',
    'WILL_O_WISP':     'Will-O-Wisp',
    'MUD_SLAP':        'Mud-Slap',
    'SOFT_BOILED':     'Soft-Boiled',
    'DOUBLE_EDGE':     'Double-Edge',
    'LOCK_ON':         'Lock-On',
    'VICE_GRIP':       'Vise Grip',
    'VICEGRIP':        'Vise Grip',
    'EXTREME_SPEED':   'Extreme Speed',
    'EXTREMESPEED':    'Extreme Speed',
    'THUNDER_PUNCH':   'Thunder Punch',
    'THUNDERPUNCH':    'Thunder Punch',
    'FIRE_PUNCH':      'Fire Punch',
    'FIREPUNCH':       'Fire Punch',
    'ICE_PUNCH':       'Ice Punch',
    'ICEPUNCH':        'Ice Punch',
    'SAND_ATTACK':     'Sand Attack',
    'SANDATTACK':      'Sand Attack',
    'GRASS_WHISTLE':   'Grass Whistle',
    'GRASSWHISTLE':    'Grass Whistle',
    'SOLAR_BEAM':      'Solar Beam',
    'SOLARBEAM':       'Solar Beam',
    'DRAGON_BREATH':   'Dragon Breath',
    'DRAGONBREATH':    'Dragon Breath',
    'DYNAMIC_PUNCH':   'Dynamic Punch',
    'DYNAMICPUNCH':    'Dynamic Punch',
    'THUNDER_SHOCK':   'Thunder Shock',
    'THUNDERSHOCK':    'Thunder Shock',
    'POISON_POWDER':   'Poison Powder',
    'POISONPOWDER':    'Poison Powder',
    'SLEEP_POWDER':    'Sleep Powder',
    'ANCIENT_POWER':   'Ancient Power',
    'ANCIENTPOWER':    'Ancient Power',
    'BUBBLE_BEAM':     'Bubble Beam',
    'BUBBLEBEAM':      'Bubble Beam',
    'PSYCHO_BOOST':    'Psycho Boost',
    'SONIC_BOOM':      'Sonic Boom',
    'SONICBOOM':       'Sonic Boom',
    'PSYCH_UP':        'Psych Up',
    'FEATHER_DANCE':   'Feather Dance',
    'FEATHERDANCE':    'Feather Dance',
};

// ── Species name overrides: key used in .h (after normalizing) → pokedex display name
const SPECIES_OVERRIDES = {
    'NIDORAN_F':  'Nidoran-F',
    'NIDORANF':   'Nidoran-F',
    'NidoranF':   'Nidoran-F',
    'NIDORAN_M':  'Nidoran-M',
    'NIDORANM':   'Nidoran-M',
    'NidoranM':   'Nidoran-M',
    'MR_MIME':    'Mr. Mime',
    'MrMime':     'Mr. Mime',
    'FARFETCHD':  "Farfetch\u0027d",
    'Farfetchd':  "Farfetch\u0027d",
    'HO_OH':      'Ho-Oh',
    'HoOh':       'Ho-Oh',
    'PORYGON2':   'Porygon2',
    'Porygon2':   'Porygon2',
    'PORYGON_Z':  'Porygon-Z',
    'PorygonZ':   'Porygon-Z',
    'DEOXYS':     'Deoxys',
    'UNOWN':      'Unown',
};

// ── helpers ──

/** Convert MOVE_XXX to display name */
function moveToDisplay(raw) {
    // raw is e.g. "MOVE_LIGHT_SCREEN"
    let key = raw.replace(/^MOVE_/, '');
    if (MOVE_OVERRIDES[key]) return MOVE_OVERRIDES[key];
    // Standard conversion: underscores → spaces, Title Case
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/** Convert SPECIES_XXX to display name */
function speciesConstToDisplay(raw) {
    // raw is e.g. "SPECIES_BULBASAUR"
    let key = raw.replace(/^SPECIES_/, '');
    if (SPECIES_OVERRIDES[key]) return SPECIES_OVERRIDES[key];
    // Standard: Title Case
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    // Note: most Gen 3 names are single-word, but multi-word names are joined (e.g., NIDOQUEEN → Nidoqueen)
}

/** Convert level-up variable name (sBulbasaurLevelUpLearnset) to display name */
function levelUpVarToDisplay(varName) {
    // e.g. "sBulbasaurLevelUpLearnset" → "Bulbasaur"
    let name = varName.replace(/^s/, '').replace(/LevelUpLearnset$/, '');
    if (SPECIES_OVERRIDES[name]) return SPECIES_OVERRIDES[name];
    // insert space before each uppercase letter that follows a lowercase, then title-case first letter
    // Actually for Pokémon names most are PascalCase single words. We just return as-is.
    return name;
}

// ── parsers ──

function parseEggMoves(text) {
    // Format: egg_moves(SPECIES, MOVE, MOVE, ...)
    const result = {};
    const re = /egg_moves\(\s*(\w+)\s*,([\s\S]*?)\)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const species = speciesConstToDisplay('SPECIES_' + m[1]);
        const movesBlock = m[2];
        const moveRe = /MOVE_(\w+)/g;
        let mm;
        const moves = [];
        while ((mm = moveRe.exec(movesBlock)) !== null) {
            moves.push(moveToDisplay('MOVE_' + mm[1]));
        }
        if (!result[species]) result[species] = [];
        result[species] = result[species].concat(moves);
    }
    return result;
}

function parseLevelUpLearnsets(text) {
    // Format: static const u16 sXxxLevelUpLearnset[] = { LEVEL_UP_MOVE(lvl, MOVE_XXX), ... };
    const result = {};
    const blockRe = /static\s+const\s+u16\s+s(\w+)LevelUpLearnset\[\]\s*=\s*\{([\s\S]*?)\};/g;
    let m;
    while ((m = blockRe.exec(text)) !== null) {
        const species = levelUpVarToDisplay('s' + m[1] + 'LevelUpLearnset');
        const movesBlock = m[2];
        const moveRe = /MOVE_(\w+)/g;
        let mm;
        const moves = new Set();
        while ((mm = moveRe.exec(movesBlock)) !== null) {
            if (mm[1] === 'NONE') continue;
            moves.add(moveToDisplay('MOVE_' + mm[1]));
        }
        if (!result[species]) result[species] = [];
        result[species] = result[species].concat([...moves]);
    }
    return result;
}

function parseTMHMLearnsets(text) {
    // Format: [SPECIES_XXX] = { .learnset = { .MOVE_FIELD = TRUE, ... } },
    const result = {};
    const blockRe = /\[SPECIES_(\w+)\]\s*=\s*\{\s*\.learnset\s*=\s*\{([\s\S]*?)\}\s*\}/g;
    let m;
    while ((m = blockRe.exec(text)) !== null) {
        const species = speciesConstToDisplay('SPECIES_' + m[1]);
        if (species === 'None') continue;
        const inner = m[2];
        // fields are like .TOXIC = TRUE, .HIDDEN_POWER = TRUE, etc.
        const fieldRe = /\.(\w+)\s*=\s*TRUE/g;
        let fm;
        const moves = [];
        while ((fm = fieldRe.exec(inner)) !== null) {
            // The field name is the move name without MOVE_ prefix
            // Convert it: TOXIC → Toxic, HIDDEN_POWER → Hidden Power
            const moveKey = fm[1];
            moves.push(moveToDisplay('MOVE_' + moveKey));
        }
        if (!result[species]) result[species] = [];
        result[species] = result[species].concat(moves);
    }
    return result;
}

function parseTutorLearnsets(text) {
    // First, build tutor move list from gTutorMoves
    const tutorMoves = [];
    const tutorMapRe = /\[TUTOR_MOVE_(\w+)\]\s*=\s*MOVE_(\w+)/g;
    let tm;
    while ((tm = tutorMapRe.exec(text)) !== null) {
        tutorMoves.push({ tutorKey: tm[1], moveName: moveToDisplay('MOVE_' + tm[2]) });
    }

    // Then parse per-species tutor learnsets
    // Format: [SPECIES_XXX] = (TUTOR(MOVE_YYY) | TUTOR(MOVE_ZZZ) | ...)
    const result = {};
        const blockRe = /\[SPECIES_(\w+)\]\s*=\s*\(([\s\S]*?)\),/g;
    let m;
    while ((m = blockRe.exec(text)) !== null) {
        const species = speciesConstToDisplay('SPECIES_' + m[1]);
        if (species === 'None') continue;
        const inner = m[2];
        if (inner.trim() === '0') continue; // no tutor moves
        const moveRe = /TUTOR\(MOVE_(\w+)\)/g;
        let mm;
        const moves = [];
        while ((mm = moveRe.exec(inner)) !== null) {
            moves.push(moveToDisplay('MOVE_' + mm[1]));
        }
        if (!result[species]) result[species] = [];
        result[species] = result[species].concat(moves);
    }
    return result;
}

// ── evolution chain parser ──

function parseEvolution(text) {
    // Builds two maps:
    //   evolvesTo:   { preEvo: [evo1, evo2, ...] }   (forward edges)
    //   preEvoOf:    { evo: [preEvo] }                (reverse edges, most have 1)
    const evolvesTo = {};
    const preEvoOf  = {};
    const re = /\[SPECIES_(\w+)\]\s*=\s*\{([\s\S]*?)\}/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const from = speciesConstToDisplay('SPECIES_' + m[1]);
        const inner = m[2];
        const targetRe = /SPECIES_(\w+)/g;
        let tm;
        while ((tm = targetRe.exec(inner)) !== null) {
            const to = speciesConstToDisplay('SPECIES_' + tm[1]);
            if (!evolvesTo[from]) evolvesTo[from] = [];
            evolvesTo[from].push(to);
            if (!preEvoOf[to]) preEvoOf[to] = [];
            if (!preEvoOf[to].includes(from)) preEvoOf[to].push(from);
        }
    }
    return { evolvesTo, preEvoOf };
}

/**
 * Get the full pre-evolution chain for a species (recursive).
 * e.g. Charizard → [Charmeleon, Charmander]
 */
function getPreEvoChain(species, preEvoOf, visited) {
    if (!visited) visited = new Set();
    if (visited.has(species)) return [];
    visited.add(species);
    const prevos = preEvoOf[species] || [];
    let chain = [];
    for (const p of prevos) {
        chain.push(p);
        chain = chain.concat(getPreEvoChain(p, preEvoOf, visited));
    }
    return chain;
}

// ── main ──

function main() {
    const eggText     = fs.readFileSync(path.join(DATA, 'egg_moves.h'), 'utf8');
    const levelText   = fs.readFileSync(path.join(DATA, 'level_up_learnsets.h'), 'utf8');
    const tmhmText    = fs.readFileSync(path.join(DATA, 'tmhm_learnsets.h'), 'utf8');
    const tutorText   = fs.readFileSync(path.join(DATA, 'tutor_learnsets.h'), 'utf8');
    const evoText     = fs.readFileSync(path.join(DATA, 'evolution.h'), 'utf8');

    const egg   = parseEggMoves(eggText);
    const level = parseLevelUpLearnsets(levelText);
    const tmhm  = parseTMHMLearnsets(tmhmText);
    const tutor = parseTutorLearnsets(tutorText);
    const { preEvoOf } = parseEvolution(evoText);

    // merge all into a single map: species → unique sorted move list
    const allSpecies = new Set([...Object.keys(egg), ...Object.keys(level), ...Object.keys(tmhm), ...Object.keys(tutor)]);
    const merged = {};
    for (const sp of [...allSpecies].sort()) {
        const movesSet = new Set();
        (egg[sp]   || []).forEach(m => movesSet.add(m));
        (level[sp] || []).forEach(m => movesSet.add(m));
        (tmhm[sp]  || []).forEach(m => movesSet.add(m));
        (tutor[sp] || []).forEach(m => movesSet.add(m));

        // Special moves (breeding / event conditions not in learnset files)
        const SPECIAL_MOVES = {
            'Pichu': ['Volt Tackle'],
            'Pikachu': ['Volt Tackle'],
            'Raichu': ['Volt Tackle'],
        };
        (SPECIAL_MOVES[sp] || []).forEach(m => movesSet.add(m));

        // Add pre-evolution level-up moves (move relearner can teach these)
        const prevoChain = getPreEvoChain(sp, preEvoOf);
        for (const prevo of prevoChain) {
            (level[prevo] || []).forEach(m => movesSet.add(m));
        }

        merged[sp] = [...movesSet].sort();
    }

    // Build output JS
    let js = '/* AUTO-GENERATED by build_learnsets.js – do not edit by hand */\n';
    js += 'var LEARNSETS = {\n';
    const sortedSpecies = Object.keys(merged).sort();
    for (let i = 0; i < sortedSpecies.length; i++) {
        const sp = sortedSpecies[i];
        const mvs = merged[sp];
        js += '  ' + JSON.stringify(sp) + ': ' + JSON.stringify(mvs);
        if (i < sortedSpecies.length - 1) js += ',';
        js += '\n';
    }
    js += '};\n';

    fs.writeFileSync(OUT, js, 'utf8');
    console.log(`Wrote ${sortedSpecies.length} species to ${OUT}`);
}

main();
