'use strict';
process.on('uncaughtException',e=>{console.error('[UNCAUGHT]',e.message,e.stack);});
process.on('unhandledRejection',(r)=>{console.error('[UNHANDLED REJECTION]',r);});
const http = require('http');
const fs   = require('fs');
const path = require('path');
const cr   = require('crypto');
const WS   = require('ws');

// ── Config ────────────────────────────────────────────────────────────────
const PORT      = process.env.PORT || 3000;
// Use /app/data on Render (mounted disk), otherwise local ./data
const DATA_DIR  = process.env.RENDER ? '/app/data' : path.join(__dirname, 'data');
const CHAR_DIR  = path.join(DATA_DIR, 'characters');
const GUILD_FILE= path.join(DATA_DIR, 'guilds.json');
[DATA_DIR, CHAR_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true}); });

function rnd(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function hash(s){ return cr.createHash('sha256').update(s+'smere_salt_v3').digest('hex'); }

// ── Races ─────────────────────────────────────────────────────────────────
const RACES = {
  human:     {name:'Human',     bonus:'Adaptable',      hp:0,  atk:0, def:0, gold:10},
  elf:       {name:'Elf',       bonus:'Arcane Sight',   hp:-2, atk:1, def:0, gold:0 },
  dwarf:     {name:'Dwarf',     bonus:'Stone Skin',     hp:5,  atk:0, def:2, gold:5 },
  halfling:  {name:'Halfling',  bonus:'Lucky',          hp:-2, atk:0, def:1, gold:15},
  orc:       {name:'Orc',       bonus:'Brutish',        hp:8,  atk:2, def:-1,gold:0 },
  tiefling:  {name:'Tiefling',  bonus:'Hellfire',       hp:0,  atk:1, def:0, gold:0 },
  dragonborn:{name:'Dragonborn',bonus:"Dragon's Breath",hp:3,  atk:2, def:0, gold:0 },
  gnome:     {name:'Gnome',     bonus:'Tinker',         hp:-3, atk:0, def:0, gold:20},
  undead:    {name:'Undead',    bonus:'Deathless',      hp:10, atk:0, def:-2,gold:0 },
  beastkin:  {name:'Beastkin',  bonus:'Primal',         hp:4,  atk:1, def:0, gold:0 },
  celestial: {name:'Celestial', bonus:'Holy Aura',      hp:2,  atk:0, def:1, gold:5 },
  goblin:    {name:'Goblin',    bonus:'Sneaky',         hp:-4, atk:2, def:0, gold:25},
  vampire:   {name:'Vampire',   bonus:'Blood Drain',    hp:5,  atk:2, def:-1,gold:0 },
  merfolk:   {name:'Merfolk',   bonus:'Tidal Force',    hp:2,  atk:1, def:1, gold:0 },
  fae:       {name:'Fae',       bonus:'Glamour',        hp:-2, atk:0, def:0, gold:30}
};

// ── Classes ───────────────────────────────────────────────────────────────
const CLASSES = {
  warrior:    {name:'Warrior',    role:'Tank',      hp:35,atk:6,def:4, gold:15,start:['Iron Sword','Leather Armor'],        skills:['power_strike','shield_wall','battle_cry','second_wind','whirlwind']},
  rogue:      {name:'Rogue',      role:'Stealth',   hp:22,atk:9,def:1, gold:25,start:['Envenomed Dagger','crude map'],      skills:['backstab','smoke_bomb','poison_blade','pickpocket','shadowstep']},
  mage:       {name:'Mage',       role:'Arcane',    hp:18,atk:5,def:1, gold:20,start:['ancient tome','Healing Potion'],     skills:['fireball','frost_bolt','arcane_shield','mana_drain','meteor']},
  ranger:     {name:'Ranger',     role:'Hunter',    hp:26,atk:7,def:2, gold:20,start:["ranger's bow",'forest cloak','swamp herb'],skills:['aimed_shot','volley','track','nature_heal','eagle_eye']},
  paladin:    {name:'Paladin',    role:'Holy',      hp:30,atk:5,def:4, gold:20,start:['Iron Sword','Iron Shield','Healing Potion'],skills:['holy_strike','lay_on_hands','divine_shield','smite','consecrate']},
  beastmaster:{name:'Beastmaster',role:'Tamer',     hp:28,atk:6,def:2, gold:20,start:["ranger's bow",'beast treat','beast treat'],skills:['beast_roar','pack_attack','wild_instinct','alpha_call','tame_skill']},
  zombie_mage:{name:'Zombie Mage',role:'Necromancy',hp:20,atk:5,def:2, gold:15,start:['ancient tome','bone shard'],        skills:['raise_dead','corpse_bomb','necrotic_bolt','death_shield','plague']},
  necromancer:{name:'Necromancer',role:'Necromancy',hp:19,atk:5,def:1, gold:15,start:['ancient tome','grave dust'],        skills:['raise_dead','soul_drain','bone_wall','curse_skill','lich_form']},
  berserker:  {name:'Berserker',  role:'Rage',      hp:32,atk:8,def:-1,gold:10,start:['Battle Axe'],                       skills:['rage','blood_lust','reckless_strike','war_cry','frenzy']},
  druid:      {name:'Druid',      role:'Nature',    hp:25,atk:4,def:2, gold:20,start:['forest cloak','swamp herb','swamp herb'],skills:['entangle','shapeshift','regrowth','summon_wolves','barkskin']},
  monk:       {name:'Monk',       role:'Martial',   hp:28,atk:7,def:3, gold:10,start:['Healing Potion'],                   skills:['ki_strike','iron_fist','deflect','meditation','thousand_cuts']},
  shadowblade:{name:'Shadowblade',role:'Hybrid',    hp:24,atk:8,def:2, gold:20,start:['Envenomed Dagger','forest cloak'],  skills:['shadow_strike','blink','curse_blade','fade','death_mark']},
  shaman:     {name:'Shaman',     role:'Spirit',    hp:24,atk:5,def:2, gold:20,start:['ancient rune','swamp herb'],        skills:['spirit_bolt','ancestral_shield','hex','chain_lightning','totem']},
  alchemist:  {name:'Alchemist',  role:'Support',   hp:22,atk:4,def:2, gold:30,start:['Healing Potion','Healing Potion','Antidote'],skills:['acid_splash','transmute','brew','explosive_flask','catalyst']},
  warlock:    {name:'Warlock',    role:'Darkness',  hp:22,atk:6,def:1, gold:15,start:['void crystal','cultist robe'],      skills:['eldritch_blast','dark_pact','banish','soul_siphon','doom']},
  templar:    {name:'Templar',    role:'Order',     hp:30,atk:5,def:5, gold:15,start:['Iron Sword','Plate Armor'],         skills:['judgement','holy_nova','fortress','inspire','purge']},
  spellblade: {name:'Spellblade', role:'Hybrid',    hp:24,atk:7,def:2, gold:20,start:['Iron Sword','ancient tome'],        skills:['runic_strike','mana_shield','spell_surge','counter_skill','arcane_blade']},
  trickster:  {name:'Trickster',  role:'Chaos',     hp:21,atk:6,def:1, gold:35,start:['crude map','Envenomed Dagger'],     skills:['confuse','mirror_image','jinx','larceny','wild_magic']},
  deathknight:{name:'Death Knight',role:'Dark Tank',hp:33,atk:7,def:3, gold:10,start:['Battle Axe','Chain Mail'],          skills:['death_strike','dark_aura','unholy_ground','bone_shield','soul_rend']},
  channeler:  {name:'Channeler',  role:'Summoner',  hp:20,atk:4,def:1, gold:20,start:['ancient tome','void crystal'],      skills:['channel_fire','channel_ice','rift','overload','elemental_form']}
};

// ── Skill metadata (name + cooldown) ─────────────────────────────────────
const SK = {
  power_strike:{n:'Power Strike',cd:3,cmb:true},   shield_wall:{n:'Shield Wall',cd:4,cmb:true},
  battle_cry:{n:'Battle Cry',cd:5,cmb:true},        second_wind:{n:'Second Wind',cd:6,cmb:true},
  whirlwind:{n:'Whirlwind',cd:5,cmb:true},           backstab:{n:'Backstab',cd:3,cmb:true},
  smoke_bomb:{n:'Smoke Bomb',cd:4,cmb:true},         poison_blade:{n:'Poison Blade',cd:5,cmb:true},
  pickpocket:{n:'Pickpocket',cd:0,cmb:false},        shadowstep:{n:'Shadowstep',cd:4,cmb:true},
  fireball:{n:'Fireball',cd:3,cmb:true},             frost_bolt:{n:'Frost Bolt',cd:3,cmb:true},
  arcane_shield:{n:'Arcane Shield',cd:5,cmb:true},   mana_drain:{n:'Mana Drain',cd:4,cmb:true},
  meteor:{n:'Meteor',cd:7,cmb:true},                 aimed_shot:{n:'Aimed Shot',cd:3,cmb:true},
  volley:{n:'Volley',cd:5,cmb:true},                 track:{n:'Track',cd:0,cmb:false},
  nature_heal:{n:'Nature Heal',cd:4,cmb:true},       eagle_eye:{n:'Eagle Eye',cd:4,cmb:true},
  holy_strike:{n:'Holy Strike',cd:3,cmb:true},       lay_on_hands:{n:'Lay on Hands',cd:4,cmb:true},
  divine_shield:{n:'Divine Shield',cd:6,cmb:true},   smite:{n:'Smite',cd:5,cmb:true},
  consecrate:{n:'Consecrate',cd:5,cmb:true},         tame_skill:{n:'Tame',cd:0,cmb:false},
  beast_roar:{n:'Beast Roar',cd:4,cmb:true},         pack_attack:{n:'Pack Attack',cd:4,cmb:true},
  wild_instinct:{n:'Wild Instinct',cd:5,cmb:true},   alpha_call:{n:'Alpha Call',cd:6,cmb:true},
  raise_dead:{n:'Raise Dead',cd:5,cmb:true},         corpse_bomb:{n:'Corpse Bomb',cd:4,cmb:true},
  necrotic_bolt:{n:'Necrotic Bolt',cd:3,cmb:true},   death_shield:{n:'Death Shield',cd:5,cmb:true},
  plague:{n:'Plague',cd:6,cmb:true},                 soul_drain:{n:'Soul Drain',cd:3,cmb:true},
  bone_wall:{n:'Bone Wall',cd:5,cmb:true},           curse_skill:{n:'Curse',cd:4,cmb:true},
  lich_form:{n:'Lich Form',cd:8,cmb:true},           rage:{n:'Rage',cd:4,cmb:true},
  blood_lust:{n:'Blood Lust',cd:5,cmb:true},         reckless_strike:{n:'Reckless Strike',cd:3,cmb:true},
  war_cry:{n:'War Cry',cd:5,cmb:true},               frenzy:{n:'Frenzy',cd:6,cmb:true},
  entangle:{n:'Entangle',cd:4,cmb:true},             shapeshift:{n:'Shapeshift',cd:6,cmb:true},
  regrowth:{n:'Regrowth',cd:4,cmb:true},             summon_wolves:{n:'Summon Wolves',cd:6,cmb:true},
  barkskin:{n:'Barkskin',cd:5,cmb:true},             ki_strike:{n:'Ki Strike',cd:3,cmb:true},
  iron_fist:{n:'Iron Fist',cd:4,cmb:true},           deflect:{n:'Deflect',cd:4,cmb:true},
  meditation:{n:'Meditation',cd:5,cmb:true},         thousand_cuts:{n:'Thousand Cuts',cd:6,cmb:true},
  shadow_strike:{n:'Shadow Strike',cd:3,cmb:true},   blink:{n:'Blink',cd:4,cmb:true},
  curse_blade:{n:'Curse Blade',cd:4,cmb:true},       fade:{n:'Fade',cd:5,cmb:true},
  death_mark:{n:'Death Mark',cd:6,cmb:true},         spirit_bolt:{n:'Spirit Bolt',cd:3,cmb:true},
  ancestral_shield:{n:'Ancestral Shield',cd:4,cmb:true},hex:{n:'Hex',cd:4,cmb:true},
  chain_lightning:{n:'Chain Lightning',cd:5,cmb:true},totem:{n:'Totem',cd:6,cmb:true},
  acid_splash:{n:'Acid Splash',cd:3,cmb:true},       transmute:{n:'Transmute',cd:5,cmb:false},
  brew:{n:'Brew',cd:0,cmb:false},                    explosive_flask:{n:'Explosive Flask',cd:4,cmb:true},
  catalyst:{n:'Catalyst',cd:5,cmb:true},             eldritch_blast:{n:'Eldritch Blast',cd:3,cmb:true},
  dark_pact:{n:'Dark Pact',cd:5,cmb:true},           banish:{n:'Banish',cd:5,cmb:true},
  soul_siphon:{n:'Soul Siphon',cd:4,cmb:true},       doom:{n:'Doom',cd:7,cmb:true},
  judgement:{n:'Judgement',cd:3,cmb:true},           holy_nova:{n:'Holy Nova',cd:5,cmb:true},
  fortress:{n:'Fortress',cd:5,cmb:true},             inspire:{n:'Inspire',cd:4,cmb:true},
  purge:{n:'Purge',cd:4,cmb:true},                   runic_strike:{n:'Runic Strike',cd:3,cmb:true},
  mana_shield:{n:'Mana Shield',cd:4,cmb:true},       spell_surge:{n:'Spell Surge',cd:5,cmb:true},
  counter_skill:{n:'Counter',cd:4,cmb:true},         arcane_blade:{n:'Arcane Blade',cd:6,cmb:true},
  confuse:{n:'Confuse',cd:3,cmb:true},               mirror_image:{n:'Mirror Image',cd:5,cmb:true},
  jinx:{n:'Jinx',cd:4,cmb:true},                     larceny:{n:'Larceny',cd:4,cmb:true},
  wild_magic:{n:'Wild Magic',cd:3,cmb:true},         death_strike:{n:'Death Strike',cd:3,cmb:true},
  dark_aura:{n:'Dark Aura',cd:5,cmb:true},           unholy_ground:{n:'Unholy Ground',cd:5,cmb:true},
  bone_shield:{n:'Bone Shield',cd:4,cmb:true},       soul_rend:{n:'Soul Rend',cd:6,cmb:true},
  channel_fire:{n:'Channel Fire',cd:3,cmb:true},     channel_ice:{n:'Channel Ice',cd:3,cmb:true},
  rift:{n:'Rift',cd:6,cmb:true},                     overload:{n:'Overload',cd:5,cmb:true},
  elemental_form:{n:'Elemental Form',cd:7,cmb:true}
};

// ── Monster portraits (served from /monsters/ static folder) ─────────────
const MOB_PORTRAITS = {
  // Frozen Tundra
  'Frost Queen':        'frost_queen.jpg',
  'Frost Knight':       'frost_knight.jpg',
  'Ice Shard Golem':    'ice_golem.jpg',
  'Yeti':               'yeti.jpg',
  'Ice Wraith':         'ice_wraith.jpg',
  'Frost Wolf':         'frost_wolf.jpg',
  // Volcanic Peak
  'Flame Titan':        'flame_titan.jpg',
  'Rock Wyrm':          'rock_wyrm.jpg',
  'Fire Imp':           'fire_imp.jpg',
  'Lava Golem':         'lava_golem.jpg',
  'Fire Elemental':     'fire_elem.jpg',
  // Dungeon Lower
  'Dungeon Lich':       'dungeon_lich.jpg',
  "Lich's Champion":    'lichs_champion.jpg',
  'Void Archon':        'void_archon.jpg',
  'Void Cultist':       'void_cultist.jpg',
  'Young Dragon':       'young_dragon.jpg',
  'Shadow Wraith':      'shadow_wraith.jpg',
  // Void Sanctum
  'Void God':           'void_god.jpg',
  'Void Scholar':       'void_scholar.jpg',
  'Null Horror':        'null_horror.jpg',
  'Void Wraith':        'void_wraith.jpg',
  // Astral Sea
  'Astral Leviathan':   'astral_leviathan.jpg',
  'Githyanki Pirate':   'githyanki.jpg',
  'Plane Walker':       'plane_walker.jpg',
  'Astral Shark':       'astral_shark.jpg',
  // Crystal Caverns
  'Crystal Golem':      'crystal_golem.jpg',
  'Gem Spider':         'gem_spider.jpg',
  'Diamond Guardian':   'diamond_guardian.jpg',
  'Prism Titan':        'prism_titan.jpg',
  // Shadow Realm
  'Void Emperor':       'void_emperor.jpg',
  'Dark Treant':        'dark_treant.jpg',
  'Banshee':            'banshee.jpg',
  'Nightmare Hound':    'nightmare_hound.jpg',
  'Shadow Demon':       'shadow_demon.jpg',
  // Sky Realm
  'Storm God':          'storm_god.jpg',
  'Stone Sentinel':     'stone_sentinel.jpg',
  'Thunder Hawk':       'thunder_hawk.jpg',
  'Wind Spirit':        'wind_spirit.jpg',
  // Haunted Keep
  'Death Baron':        'death_baron.jpg',
  'Bone Horror':        'bone_horror.jpg',
  'Chained Revenant':   'chained_revenant.jpg',
  'Cursed Knight':      'cursed_knight.jpg',
  'Wailing Specter':    'wailing_specter.jpg',
  // Ashford Bandits
  'Bandit King':        'bandit_king.jpg',
  'Bandit Thug':        'bandit_thug.jpg',
  'Bandit Scout':       'bandit_scout.jpg',
  // Night creatures
  'Night Horror':       'night_horror.jpg',
  'Shadow Stalker':     'shadow_stalker.jpg',
  // Forest
  'Bog Witch':          'bog_witch.jpg',
  'Swamp Serpent':      'swamp_serpent.jpg',
  'Stone Golem':        'stone_golem.jpg',
  'Forest Troll':       'forest_troll.jpg',
  'Timber Wolf':        'timber_wolf.jpg',
  'Giant Rat':          'giant_rat.jpg',
  // Dungeon Upper
  'Corrupt Priest':     'corrupt_priest.jpg',
  'Prison Guard Ghost': 'prison_guard_ghost.jpg',
  'Crypt Lich':         'crypt_lich.jpg',
  'Risen Cultist':      'risen_cultist.jpg',
  'Risen Corpse':       'risen_corpse.jpg',
  'Armored Skeleton':   'armor_skel.jpg',
  'Skeleton Warrior':   'skel_warrior.jpg',
};

// ── Skill execution ───────────────────────────────────────────────────────
function execSkill(ws, p, sid, m) {
  const D = (base, bonus=0, nodef=false) => {
    const d = Math.max(1, Math.floor(base) - (nodef?0:m.def) + rnd(-1,bonus));
    m.hp -= d;
    return d;
  };
  // Helper to show HP after skill damage
  const showHP = () => {
    if(m&&m.hp!==undefined) say(ws,`  ${m.name}: ${Math.max(0,m.hp)}/${m.maxhp} HP remaining`,'combat');
  };
  const H = n => { const h=Math.min(n,p.maxhp-p.hp); p.hp+=h; return h; };
  if (!p.cd) p.cd = {};

  switch(sid) {
    case 'power_strike':    { const r=D(p.atk*2,3);      say(ws,`POWER STRIKE — ${r} damage!`,'skill'); break; }
    case 'shield_wall':     { p.sh.wall=8;                say(ws,'SHIELD WALL — 8 damage shield!','skill'); break; }
    case 'battle_cry':      { p.bcT=3;p.bcV=3;            say(ws,'BATTLE CRY — Enemy ATK -3 for 3 turns!','skill'); break; }
    case 'second_wind':     { const r=H(15);              say(ws,`SECOND WIND — +${r} HP!`,'skill'); break; }
    case 'whirlwind':       { const r=D(p.atk*1.5,2);    say(ws,`WHIRLWIND — ${r} damage!`,'skill'); break; }
    case 'backstab':        { const mult=p.backstabUsed?1.5:3.5; p.backstabUsed=true; const r=D(p.atk*mult,2); say(ws,`BACKSTAB — ${r} vital damage!`,'skill'); break; }
    case 'smoke_bomb':      {
      const exits=Object.keys(world[p.room]&&world[p.room].exits||{});
      if(exits.length){const dir=exits[0];p.room=world[p.room].exits[dir];p.inCombat=false;p.enemy=null;say(ws,`SMOKE BOMB — Fled ${dir}!`,'skill');return'fled';}
      say(ws,'No exits!','err'); break;
    }
    case 'poison_blade':    { p.pbT=4;p.pbD=4;            say(ws,'POISON BLADE — +4 dmg/hit for 4 turns.','skill'); break; }
    case 'pickpocket':      { say(ws,'Pickpocket activates on kills.','sys'); break; }
    case 'shadowstep':      { const r=D(p.atk*2); p.sh.shadow=1; say(ws,`SHADOWSTEP — ${r} damage! Next hit dodged.`,'skill'); break; }
    case 'fireball':        { const r=D(p.atk*3,4);       say(ws,`FIREBALL — ${r} fire damage!`,'skill'); break; }
    case 'frost_bolt':      { const r=D(p.atk*2,2); p.frozenT=1; say(ws,`FROST BOLT — ${r} damage, frozen!`,'skill'); break; }
    case 'arcane_shield':   { p.sh.arcane=12;             say(ws,'ARCANE SHIELD — 12 damage barrier!','skill'); break; }
    case 'mana_drain':      { const r=D(p.atk); const h=H(10); say(ws,`MANA DRAIN — ${r} dmg, +${h} HP!`,'skill'); break; }
    case 'meteor':          { const r=D(p.atk*4,6);       say(ws,`METEOR — Catastrophic ${r} damage!`,'skill'); break; }
    case 'aimed_shot':      { const r=D(p.atk*2.5,3);    say(ws,`AIMED SHOT — ${r} precision arrow!`,'skill'); break; }
    case 'volley':          { const r=D(p.atk*2,2);       say(ws,`VOLLEY — ${r} arrow hail!`,'skill'); break; }
    case 'track':           {
      Object.keys((world[p.room]&&world[p.room].exits)||{}).forEach(dir=>{
        const rm=world[(world[p.room].exits||{})[dir]];
        if(rm){const ms=(rm.monsters||[]).filter(x=>!x.dead).map(x=>x.name).join(',')||'none';say(ws,`  ${dir.toUpperCase()} [${rm.name}] Monsters:${ms}`,'sys');}
      }); break;
    }
    case 'nature_heal':     { const r=H(14);              say(ws,`NATURE HEAL — +${r} HP!`,'skill'); break; }
    case 'eagle_eye':       { const r=D(p.atk*2,0,true);  say(ws,`EAGLE EYE — ${r} damage (ignores DEF)!`,'skill'); break; }
    case 'holy_strike':     { const r=D(p.atk*2+6,2);    say(ws,`HOLY STRIKE — ${r} divine damage!`,'skill'); break; }
    case 'lay_on_hands':    { const r=H(22);              say(ws,`LAY ON HANDS — +${r} HP!`,'skill'); break; }
    case 'divine_shield':   { p.sh.divine=true;           say(ws,'DIVINE SHIELD — Next attack blocked!','skill'); break; }
    case 'smite':           { const un=/skeleton|lich|ghost|corpse|wraith|risen|zombie/i.test(m.name); const r=D(p.atk*(un?3.5:1.5),3); say(ws,`SMITE — ${r} holy wrath!${un?' HOLY WEAKNESS!':''}`,'skill'); break; }
    case 'consecrate':      { p.consecT=3; const r=H(8);  say(ws,`CONSECRATE — +${r} HP, 4 dmg/turn to enemy.`,'skill'); break; }
    case 'tame_skill':      { doTame(ws,p); break; }
    case 'beast_roar':      { p.bcT=3;p.bcV=3; const pd=p.companion?rnd(3,8):0; if(pd>0)m.hp-=pd; say(ws,`BEAST ROAR — Enemy ATK-3!${pd?' Companion:+'+pd:''}`,'skill'); break; }
    case 'pack_attack':     { const r=D(p.atk*1.5); const pd=p.companion?rnd(5,12):0; m.hp-=pd; say(ws,`PACK ATTACK — You:${r} + Companion:${pd}!`,'skill'); break; }
    case 'wild_instinct':   { p.sh.wild=6; const r=H(8);  say(ws,`WILD INSTINCT — +${r} HP, 6 shield!`,'skill'); break; }
    case 'alpha_call':      { const r=D(p.atk*2); const pd=p.companion?rnd(8,15):0; m.hp-=pd; say(ws,`ALPHA CALL — You:${r}${pd?'+'+pd:''}!`,'skill'); break; }
    case 'raise_dead':      { doRaiseDead(ws,p); break; }
    case 'corpse_bomb':     { if(!p.zombies||!p.zombies.length){say(ws,'No zombies!','err');break;} const z=p.zombies.pop(); const r=Math.max(8,z.hp*2+rnd(0,10)); m.hp-=r; say(ws,`CORPSE BOMB — ${z.name} explodes for ${r}!`,'skill'); break; }
    case 'necrotic_bolt':   { const r=D(p.atk*2.5,3); const h=H(Math.floor(r/3)); say(ws,`NECROTIC BOLT — ${r} necrotic damage! Life drain: +${h} HP restored. [${p.hp}/${p.maxhp}]`,'skill'); break; }
    case 'death_shield':    { p.sh.death=14; say(ws,'DEATH SHIELD — A 14-point necrotic barrier surrounds you. Next 14 damage absorbed!','skill'); break; }
    case 'plague':          { p.plagueT=4;p.plagueD=5; say(ws,`PLAGUE — ${m.name} is infected! 5 necrotic damage per turn for 4 turns.`,'skill'); break; }
    case 'soul_drain':      { const r=D(p.atk*1.5); const h=H(Math.floor(r/2)); say(ws,`SOUL DRAIN — ${r} dmg, +${h} HP!`,'skill'); break; }
    case 'bone_wall':       { p.sh.bone=16;               say(ws,'BONE WALL — 16 damage barrier!','skill'); break; }
    case 'curse_skill':     { p.curseT=4;p.curseD=4; m.hp-=rnd(5,10); say(ws,'CURSE — Enemy weakened!','skill'); break; }
    case 'lich_form':       { if(!p._lichActive){p.atk+=4;p.def+=2;p._lichActive=true;} p.lichT=3; say(ws,'LICH FORM — ATK+4, DEF+2 for 3 turns!','skill'); break; }
    case 'rage':            { p.rageT=3;p.rageA=4;        say(ws,'RAGE — ATK +4 for 3 turns!','skill'); break; }
    case 'blood_lust':      { const r=D(p.atk*2); const h=H(Math.floor(r/2)); say(ws,`BLOOD LUST — ${r} dmg, +${h} HP!`,'skill'); break; }
    case 'reckless_strike': { const r=D(p.atk*3,4); p.hp=Math.max(1,p.hp-4); say(ws,`RECKLESS STRIKE — ${r} damage! -4 HP.`,'skill'); break; }
    case 'war_cry':         { p.bcT=4;p.bcV=4;            say(ws,'WAR CRY — Enemy ATK -4 for 4 turns!','skill'); break; }
    case 'frenzy':          { const r1=D(p.atk); const r2=D(p.atk); say(ws,`FRENZY — Two strikes: ${r1}+${r2}!`,'skill'); break; }
    case 'entangle':        { p.frozenT=2;                say(ws,'ENTANGLE — Enemy rooted 2 turns!','skill'); break; }
    case 'shapeshift':      { if(!p._shiftActive){p.atk+=3;p.def+=3;p._shiftActive=true;} p.shiftT=3; say(ws,'SHAPESHIFT — Bear form! ATK+3, DEF+3.','skill'); break; }
    case 'regrowth':        { p.regrowthT=3; const r=H(10); say(ws,`REGROWTH — +${r} HP now, +5/turn x3.`,'skill'); break; }
    case 'summon_wolves':   { const r=rnd(8,16); m.hp-=r;  say(ws,`SUMMON WOLVES — Pack deals ${r} damage!`,'skill'); break; }
    case 'barkskin':        { p.sh.bark=10; p.def+=2;     say(ws,'BARKSKIN — 10 shield + DEF +2!','skill'); break; }
    case 'ki_strike':       { const r=D(p.atk*2,0,true);  say(ws,`KI STRIKE — ${r} internal force (no DEF)!`,'skill'); break; }
    case 'iron_fist':       { const r=D(p.atk*2.5,3);    say(ws,`IRON FIST — ${r} devastating punch!`,'skill'); break; }
    case 'deflect':         { p.sh.deflect=1;             say(ws,'DEFLECT — Next attack dodged!','skill'); break; }
    case 'meditation':      { const r=H(18);              say(ws,`MEDITATION — +${r} HP.`,'skill'); break; }
    case 'thousand_cuts':   { let t=0; for(let i=0;i<5;i++){const r=Math.max(1,rnd(2,p.atk));m.hp-=r;t+=r;} say(ws,`THOUSAND CUTS — 5 strikes, ${t} total!`,'skill'); break; }
    case 'shadow_strike':   { const r=D(p.atk*2.5,2);    say(ws,`SHADOW STRIKE — ${r} from darkness!`,'skill'); break; }
    case 'blink':           { const r=D(p.atk*1.5); p.sh.blink=1; say(ws,`BLINK — ${r} damage! Next hit dodged.`,'skill'); break; }
    case 'curse_blade':     { p.pbT=4;p.pbD=5;            say(ws,'CURSE BLADE — +5 shadow/hit for 4 turns.','skill'); break; }
    case 'fade':            { p.sh.fade=3;                say(ws,'FADE — Next 3 hits reduced 50%.','skill'); break; }
    case 'death_mark':      { p.deathmarkT=3;             say(ws,'DEATH MARK — All damage +50% for 3 turns.','skill'); break; }
    case 'spirit_bolt':     { const r=D(p.atk*2,2);       say(ws,`SPIRIT BOLT — ${r} ancestral wrath!`,'skill'); break; }
    case 'ancestral_shield':{ p.sh.ancestral=10; const r=H(6); say(ws,`ANCESTRAL SHIELD — 10 shield, +${r} HP!`,'skill'); break; }
    case 'hex':             { p.bcT=4;p.bcV=3;p.curseT=3;p.curseD=3; say(ws,'HEX — Enemy weakened and cursed!','skill'); break; }
    case 'chain_lightning': { const r=D(p.atk*3,5);       say(ws,`CHAIN LIGHTNING — ${r} lightning!`,'skill'); break; }
    case 'totem':           { p.totemT=4;p.totemH=5;      say(ws,'TOTEM — +5 HP/turn for 4 turns!','skill'); break; }
    case 'acid_splash':     { const r=D(p.atk*1.5); p.pbT=3;p.pbD=4; say(ws,`ACID SPLASH — ${r} acid + melting armor!`,'skill'); break; }
    case 'transmute':       { if(p.gold>=10){p.gold-=10;const r=H(25);say(ws,`TRANSMUTE — 10g -> +${r} HP!`,'ok');}else say(ws,'Need 10g.','err'); break; }
    case 'brew':            { p.inventory.push('Healing Potion'); say(ws,'BREW — Crafted a Healing Potion!','ok'); break; }
    case 'explosive_flask': { const r=D(p.atk*2.5,5);    say(ws,`EXPLOSIVE FLASK — ${r} blast damage!`,'skill'); break; }
    case 'catalyst':        { if(!p._catalystActive){p.atk+=3;p._catalystActive=true;} p.catalystT=3; say(ws,'CATALYST — ATK +3 for 3 turns!','skill'); break; }
    case 'eldritch_blast':  { const r=D(p.atk*2.5,4);    say(ws,`ELDRITCH BLAST — ${r} void energy!`,'skill'); break; }
    case 'dark_pact':       { p.hp=Math.max(1,p.hp-8); if(!p._darkPactActive){p.atk+=5;p._darkPactActive=true;} p.darkpactT=4; say(ws,'DARK PACT — -8 HP, ATK +5 for 4 turns.','skill'); break; }
    case 'banish':          { p.frozenT=2; const r=D(p.atk*1.5); say(ws,`BANISH — ${r} void, stunned 2 turns.`,'skill'); break; }
    case 'soul_siphon':     { const r=D(p.atk*1.5); const h=H(r); say(ws,`SOUL SIPHON — ${r} dmg, +${h} HP!`,'skill'); break; }
    case 'doom':            { p.doomT=3;                   say(ws,'DOOM — Double damage for 3 turns!','skill'); break; }
    case 'judgement':       { const r=D(p.atk*2,2);       say(ws,`JUDGEMENT — ${r} divine!`,'skill'); break; }
    case 'holy_nova':       { const r=D(p.atk*1.5); const h=H(10); say(ws,`HOLY NOVA — ${r} dmg, +${h} HP!`,'skill'); break; }
    case 'fortress':        { p.sh.fortress=20;            say(ws,'FORTRESS — 20 damage citadel shield!','skill'); break; }
    case 'inspire':         { const h=H(12); if(!p._inspireActive){p.atk+=2;p._inspireActive=true;} p.inspireT=3; say(ws,`INSPIRE — +${h} HP, ATK+2 for 3 turns!`,'skill'); break; }
    case 'purge':           { p.pbT=0;p.plagueT=0;p.curseT=0; const h=H(8); say(ws,`PURGE — Cleansed! +${h} HP.`,'skill'); break; }
    case 'runic_strike':    { const r=D(p.atk*2,0,true);  say(ws,`RUNIC STRIKE — ${r} enchanted (no DEF)!`,'skill'); break; }
    case 'mana_shield':     { p.sh.mana=14;               say(ws,'MANA SHIELD — 14 arcane barrier!','skill'); break; }
    case 'spell_surge':     { const r=D(p.atk*3.5,5);    say(ws,`SPELL SURGE — ${r} arcane explosion!`,'skill'); break; }
    case 'counter_skill':   { p.sh.counter=1;             say(ws,'COUNTER — Next hit reflected!','skill'); break; }
    case 'arcane_blade':    { p.pbT=4;p.pbD=6; if(!p._arcaneBladeActive){p.atk+=2;p._arcaneBladeActive=true;} say(ws,'ARCANE BLADE — ATK+2, +6 magic/hit x4.','skill'); break; }
    case 'confuse':         { p.bcT=3;p.bcV=4;            say(ws,'CONFUSE — Enemy ATK -4 for 3 turns!','skill'); break; }
    case 'mirror_image':    { p.sh.mirror=2;              say(ws,'MIRROR IMAGE — Next 2 attacks miss!','skill'); break; }
    case 'jinx':            { p.curseT=4;p.curseD=5; const r=D(p.atk); say(ws,`JINX — ${r} dmg, cursed 5/turn x4.`,'skill'); break; }
    case 'larceny':         { const s=rnd(5,15);p.gold+=s; say(ws,`LARCENY — Pickpocketed ${s}g!`,'skill'); break; }
    case 'wild_magic':      { const r=rnd(1,p.atk*6);m.hp-=r; say(ws,`WILD MAGIC — Chaotic ${r} damage!`,'skill'); break; }
    case 'death_strike':    { const r=D(p.atk*2.5,3); const h=H(Math.floor(r/3)); say(ws,`DEATH STRIKE — ${r} dmg, +${h} HP!`,'skill'); break; }
    case 'dark_aura':       { p.darkAuraT=4;              say(ws,'DARK AURA — Dark skills +30% for 4 turns.','skill'); break; }
    case 'unholy_ground':   { p.plagueT=4;p.plagueD=6;    say(ws,'UNHOLY GROUND — 6 necrotic/turn x4.','skill'); break; }
    case 'bone_shield':     { p.sh.bone=18;               say(ws,'BONE SHIELD — 18 damage barrier!','skill'); break; }
    case 'soul_rend':       { const r=D(p.atk*3,5); p.frozenT=1; say(ws,`SOUL REND — ${r} damage, stunned!`,'skill'); break; }
    case 'channel_fire':    { const r=D(p.atk*2.5,4);    say(ws,`CHANNEL FIRE — ${r} elemental fire!`,'skill'); break; }
    case 'channel_ice':     { const r=D(p.atk*2,2); p.frozenT=1; say(ws,`CHANNEL ICE — ${r} damage, frozen!`,'skill'); break; }
    case 'rift':            { const r=rnd(15,p.atk*4);m.hp-=r; say(ws,`RIFT — Dimensional tear ${r} void!`,'skill'); break; }
    case 'overload':        { const r=D(p.atk*3.5,6); p.hp=Math.max(1,p.hp-6); say(ws,`OVERLOAD — ${r} explosion! -6 HP.`,'skill'); break; }
    case 'elemental_form':  { if(!p._elementalActive){p.atk+=5;p._elementalActive=true;} p.elementalT=4; say(ws,'ELEMENTAL FORM — ATK +5 for 4 turns!','skill'); break; }
  }
  // Show monster HP after any damaging skill
  if(m && m.hp!==undefined && sid!=='smoke_bomb' && sid!=='track' && sid!=='brew' && sid!=='pickpocket') {
    say(ws,`  ${m.name}: ${Math.max(0,m.hp)}/${m.maxhp} HP remaining`,'combat');
  }
}

// ── Equippable items ──────────────────────────────────────────────────────
const EQ = {
  // Bags / containers — equip to get extra carry slots
  'worn satchel':   {t:'bag',atk:0,def:0,slots:6,  desc:'A battered leather satchel. Holds 6 items.'},
  'leather satchel':{t:'bag',atk:0,def:0,slots:10, desc:'A sturdy leather satchel. Holds 10 items.'},
  'traveller bag':  {t:'bag',atk:0,def:0,slots:12, desc:'A spacious traveller bag. Holds 12 items.'},
  'merchant sack':  {t:'bag',atk:0,def:0,slots:15, desc:'A large merchant sack. Holds 15 items.'},
  'magic satchel':  {t:'bag',atk:0,def:0,slots:20, desc:'A satchel with magical extra-dimensional space. Holds 20 items.'},
  // ── Quest reward weapons ───────────────────────────────────────────────
  "knight's sword":   {t:'weapon',atk:10,def:0, desc:"A finely balanced sword."},
  'bone staff':       {t:'weapon',atk:10,def:1, desc:"A staff carved from dungeon bones."},
  // ── Boss drop weapons ────────────────────────────────────────────────────
  'silver sword':     {t:'weapon',atk:12,def:1, desc:"Githyanki silver, never dulls."},
  'cursed blade':     {t:'weapon',atk:14,def:0, desc:"Radiates dark energy. Unsettling."},
  'frost blade':      {t:'weapon',atk:14,def:2, desc:"Permanently cold. Slows enemies."},
  // ── Boss drop armor ──────────────────────────────────────────────────────
  'cultist robe':     {t:'armor', atk:2, def:1, desc:"Dark cloth stitched with runes."},
  // ── Legendary boss crowns / trophies (wearable) ──────────────────────────
  "lich's crown":     {t:'armor', atk:3, def:5, desc:"The Dungeon Lich's iron crown. Radiates dark power. Intimidates all who see it."},
  "titan's core":     {t:'trinket',atk:5,def:3, desc:"The Flame Titan's molten heart. Burns cold in your hand."},
  "frost queen's crown":{t:'armor',atk:2,def:6, desc:"Ice crown of the Frost Queen. Bitter cold, beautiful."},
  "storm god's aegis":{t:'armor', atk:0,def:8, desc:"Divine shield of the Storm God. Lightning crackles across its surface."},
  "void emperor's sigil":{t:'trinket',atk:6,def:4,desc:"The Void Emperor's seal. Reality wavers around it."},
  "prism titan's core":{t:'trinket',atk:5,def:5,desc:"A crystalline core that refracts all light."},
  "death baron's crown":{t:'armor',atk:4,def:7, desc:"The Death Baron's iron crown. Commands respect — and fear."},
  "leviathan's scale": {t:'armor', atk:2,def:9, desc:"Astral dragon scale. Near impenetrable."},
  "void god's essence":{t:'trinket',atk:8,def:6, desc:"The essence of the Void God. Terrible, beautiful power."},
  // ── Craftable items already registered above ─────────────────────────────
  "bandit king's blade":{t:'weapon',atk:16,def:2,desc:'Heavy cleaver of the Bandit King. Notched from countless fights.'},
  'silver ring':{t:'armor',atk:0,def:1},"ranger's bow":{t:'weapon',atk:6,def:0},
  'forest cloak':{t:'armor',atk:0,def:3},'enchanted gem':{t:'trinket',atk:2,def:2},
  'rusty sword':{t:'weapon',atk:2,def:0},'iron sword':{t:'weapon',atk:4,def:0},
  'battle axe':{t:'weapon',atk:7,def:-1},"knight's sword":{t:'weapon',atk:10,def:0},
  'shadow blade':{t:'weapon',atk:15,def:2},'leather armor':{t:'armor',atk:0,def:2},
  'chain mail':{t:'armor',atk:0,def:4},'plate armor':{t:'armor',atk:0,def:7},
  'iron shield':{t:'armor',atk:0,def:3},'envenomed dagger':{t:'weapon',atk:12,def:0},
  'void cloak':{t:'armor',atk:2,def:5},'frost blade':{t:'weapon',atk:14,def:2},
  "warrior's blade":{t:'weapon',atk:13,def:1},'shadow cloak':{t:'armor',atk:1,def:6},
  'venomsteel dagger':{t:'weapon',atk:16,def:0},'arcane tome':{t:'weapon',atk:8,def:2},
  'dragon scale mail':{t:'armor',atk:0,def:12},'void blade':{t:'weapon',atk:20,def:3},
  'troll hide armor':{t:'armor',atk:0,def:9},'bone staff':{t:'weapon',atk:10,def:1}
};

// ── Shops ─────────────────────────────────────────────────────────────────
const SHOPS = {
  weaponsmith:{name:"Grimwald's Weaponsmith",greet:"Grimwald grunts. 'Fine steel. Fair prices.'",items:[
    {name:'Worn Satchel',cost:20,t:'bag',slots:6},{name:'Leather Satchel',cost:60,t:'bag',slots:10},{name:'Traveller Bag',cost:120,t:'bag',slots:12},
    {name:'Rusty Sword',cost:10,t:'weapon',atk:2,def:0},{name:'Iron Sword',cost:30,t:'weapon',atk:4,def:0},
    {name:'Battle Axe',cost:60,t:'weapon',atk:7,def:-1},{name:"Knight's Sword",cost:120,t:'weapon',atk:10,def:0},
    {name:'Shadow Blade',cost:250,t:'weapon',atk:15,def:2},{name:'Leather Armor',cost:25,t:'armor',atk:0,def:2},
    {name:'Chain Mail',cost:70,t:'armor',atk:0,def:4},{name:'Plate Armor',cost:180,t:'armor',atk:0,def:7},
    {name:'Iron Shield',cost:40,t:'armor',atk:0,def:3}
  ]},
  apothecary:{name:"Mira's Apothecary",greet:"'Name your ailment.'",items:[
    {name:'Healing Potion',cost:12,t:'potion',heal:20},{name:'Greater Heal',cost:30,t:'potion',heal:50},
    {name:'Full Restore',cost:80,t:'potion',heal:9999},{name:'Strength Tonic',cost:50,t:'tonic',atk:3},
    {name:'Iron Skin Draught',cost:50,t:'tonic',def:2},{name:'Antidote',cost:8,t:'potion',heal:0},
    {name:'beast treat',cost:15,t:'item'}
  ]},
  black_market:{name:'The Shadow Broker',greet:"'No questions. No receipts.'",items:[
    {name:'Merchant Sack',cost:200,t:'bag',slots:15},{name:'Magic Satchel',cost:500,t:'bag',slots:20},
    {name:'Envenomed Dagger',cost:200,t:'weapon',atk:12,def:0},{name:'Void Cloak',cost:180,t:'armor',atk:2,def:5},
    {name:'Elixir of Power',cost:300,t:'tonic',atk:8},{name:'Elixir of Stone',cost:300,t:'tonic',def:8},
    {name:'Phoenix Draught',cost:150,t:'potion',heal:9999}
  ]},
  ashford_store:{name:"Martas General Store",greet:"Marta eyes you. 'Coin upfront. No trouble.'",items:[
    {name:'Healing Potion',cost:10,t:'potion',heal:20},{name:'Antidote',cost:6,t:'potion',heal:0},
    {name:'Worn Satchel',cost:15,t:'bag',slots:6},{name:'torch',cost:2,t:'item'},
    {name:'Iron Sword',cost:25,t:'weapon',atk:4,def:0},{name:'Leather Armor',cost:20,t:'armor',atk:0,def:2},
    {name:'swamp herb',cost:5,t:'item'},{name:'crude map',cost:3,t:'item'}
  ]},
  ashford_healer:{name:"Brother Finn Healing Post",greet:"Finn smiles gently. 'The light mend you, traveller.'",items:[
    {name:'Healing Potion',cost:10,t:'potion',heal:20},{name:'Greater Heal',cost:25,t:'potion',heal:50},
    {name:'Full Restore',cost:70,t:'potion',heal:9999},{name:'swamp herb',cost:4,t:'item'},
    {name:'Antidote',cost:6,t:'potion',heal:0},{name:'beast treat',cost:12,t:'item'}
  ]},
  pet_store:{name:"Pip's Exotic Menagerie",greet:"Pip beams. 'Every pet is friendly. Mostly!'",items:[
    {name:'Black Cat',cost:30,t:'pet',atk:3,hp:20},{name:'War Hound',cost:80,t:'pet',atk:8,hp:40},
    {name:'Raven',cost:50,t:'pet',atk:4,hp:18},{name:'Cave Bear',cost:150,t:'pet',atk:11,hp:55},
    {name:'Shadow Fox',cost:120,t:'pet',atk:9,hp:35},{name:'Frost Hawk',cost:100,t:'pet',atk:8,hp:30},
    {name:'Iron Tortoise',cost:90,t:'pet',atk:5,hp:70},{name:'Imp',cost:200,t:'pet',atk:12,hp:30}
  ]}
};

// ── Tameable monsters ─────────────────────────────────────────────────────
const TAMEABLE = {
  'Timber Wolf':{atk:6,hp:30},'Giant Rat':{atk:3,hp:15},
  'Swamp Serpent':{atk:7,hp:25},'Forest Troll':{atk:9,hp:45},
  'Young Dragon':{atk:14,hp:60},'Bog Witch':{atk:10,hp:40}
};

// ── Crafting recipes ──────────────────────────────────────────────────────
const RECIPES = [
  {name:"Warrior's Blade",  result:"Warrior's Blade",  ing:['Iron Sword','obsidian shard','bone shard']},
  {name:"Shadow Cloak",     result:"Shadow Cloak",     ing:['forest cloak','void crystal','shadow essence']},
  {name:"Venomsteel Dagger",result:"Venomsteel Dagger",ing:['Envenomed Dagger','serpent fang','void crystal']},
  {name:"Dragon Scale Mail",result:"Dragon Scale Mail",ing:['dragon scale','dragon scale','Chain Mail']},
  {name:"Void Blade",       result:"Void Blade",       ing:['Shadow Blade','void crystal','void crystal']},
  {name:"Greater Heal",     result:"Greater Heal",     ing:['Healing Potion','Healing Potion','swamp herb']},
  {name:"Bone Staff",       result:"Bone Staff",       ing:['bone shard','bone shard','ancient rune']},
  {name:"Troll Hide Armor", result:"Troll Hide Armor", ing:['troll hide','troll hide','Leather Armor']}
];

// ── World ─────────────────────────────────────────────────────────────────
const M = (id,name,hp,atk,def,xp,gold,loot) => ({id,name,hp,maxhp:hp,atk,def,xp,gold,loot,dead:false});
const WT = {
  // Town
  town_square:     {zone:'TOWN OF SHADOWMERE',name:'Town Square',desc:'The cobblestone square hums with magical energy. At its centre the Adventure Shrine crackles with azure light. A notice board lists bounties.',exits:{north:'market_street',east:'tavern',south:'south_gate',west:'temple',up:'adventure_shrine'},base:['old coin'],mon:[],shop:null,teleport:false},
  adventure_shrine:{zone:'TOWN OF SHADOWMERE',name:'The Adventure Shrine',desc:'Ancient standing stones pulse with power. The Keeper tends the runes, whispering the names of distant lands.',exits:{down:'town_square'},base:[],mon:[],shop:null,teleport:true},
  market_street:   {zone:'TOWN OF SHADOWMERE',name:'Market Street',desc:'A cobblestone lane. The smith hammers to the north. The Menagerie banners hang to the west.',exits:{south:'town_square',north:'weaponsmith',east:'alley',west:'pet_store'},base:[],mon:[],shop:null},
  pet_store:       {zone:'TOWN OF SHADOWMERE',name:"Pip's Exotic Menagerie",desc:'A riot of cages and exotic animals. Pip the halfling beams from behind the counter.',exits:{east:'market_street'},base:[],mon:[],shop:'pet_store'},
  weaponsmith:     {zone:'TOWN OF SHADOWMERE',name:"Grimwald's Weaponsmith",desc:'The forge blazes. Weapons line the walls. Grimwald watches with arms crossed.',exits:{south:'market_street'},base:[],mon:[],shop:'weaponsmith'},
  alley:           {zone:'TOWN OF SHADOWMERE',name:'Dark Alley',desc:'A narrow passage reeking of mildew. Rats scatter. A crude map nailed to a post.',exits:{west:'market_street',south:'black_market'},base:['crude map'],mon:[M('giant_rat','Giant Rat',8,2,0,15,3,'rat tail')],shop:null},
  black_market:    {zone:'TOWN OF SHADOWMERE',name:'The Shadow Broker',desc:'A cellar. A single lantern. A hooded figure utterly still.',exits:{north:'alley'},base:[],mon:[],shop:'black_market'},
  tavern:          {zone:'TOWN OF SHADOWMERE',name:'The Broken Flagon',desc:'A tavern frozen in time. Half-full tankards, a smouldering hearth. Tormund is behind the bar.',exits:{west:'town_square',east:'apothecary'},base:[],mon:[],shop:null},
  apothecary:      {zone:'TOWN OF SHADOWMERE',name:"Mira's Apothecary",desc:'Shelves of vials and herbs. Mira works at her bench without looking up.',exits:{west:'tavern'},base:[],mon:[],shop:'apothecary'},
  temple:          {zone:'TOWN OF SHADOWMERE',name:'Temple of the Fallen',desc:'A once-grand temple half in ruin. Father Aldric kneels at the altar. North leads to the Guild District.',exits:{east:'town_square',south:'temple_crypt',north:'guild_district'},base:[],mon:[],shop:null},
  south_gate:      {zone:'TOWN OF SHADOWMERE',name:'South Gate',desc:'Iron-banded doors torn from their hinges. The forest lies south, dungeon stairs descend here.',exits:{north:'town_square',south:'ashwood_edge',down:'dungeon_entrance'},base:['torch'],mon:[],shop:null},
  guild_district:  {zone:'TOWN OF SHADOWMERE',name:'Guild District',desc:'A broad lane of imposing guild buildings. The Guild Registry is north. Guild Hall Row is east.',exits:{south:'temple',north:'guild_registry',east:'guild_hall_row'},base:[],mon:[],shop:null,guildDistrict:true},
  guild_registry:  {zone:'TOWN OF SHADOWMERE',name:'Guild Registry',desc:'An officious clerk in spectacles surrounded by ledgers. Type GUILD LIST to see guilds, GUILD CREATE [name] to register yours.',exits:{south:'guild_district'},base:[],mon:[],shop:null},
  guild_hall_row:  {zone:'TOWN OF SHADOWMERE',name:'Guild Hall Row',desc:'A row of grand hall entrances. Each bears its guild name above the door. Type GUILDHALL to enter yours.',exits:{west:'guild_district'},base:[],mon:[],shop:null,guildHallRow:true},
  // Forest
  ashwood_edge:    {zone:'ASHWOOD FOREST',name:'Ashwood Edge',desc:'Pale ash-barked trees. Grey light. Wolves howl in the fog.',exits:{north:'south_gate',south:'ashwood_deep',east:'forest_camp'},base:['swamp herb'],mon:[M('timber_wolf','Timber Wolf',12,4,1,25,4,'cave moss')],shop:null},
  forest_camp:     {zone:'ASHWOOD FOREST',name:"Ranger's Camp",desc:'A cold campsite of a ranger who never returned.',exits:{west:'ashwood_edge'},base:["ranger's bow",'forest cloak'],mon:[],shop:null},
  ashwood_deep:    {zone:'ASHWOOD FOREST',name:'Deep Ashwood',desc:'Trees press close. Something large moves between the trunks. A worn path leads east to Ashford Village.',exits:{north:'ashwood_edge',south:'swamp_border',west:'forest_ruins',east:'ashford_gate'},base:[],mon:[M('forest_troll','Forest Troll',28,7,2,60,12,'troll hide'),M('timber_wolf2','Timber Wolf',12,4,1,25,4,'cave moss')],shop:null},
  forest_ruins:    {zone:'ASHWOOD FOREST',name:'Forest Ruins',desc:'Ancient moss-draped walls. An altar glints with forgotten treasure.',exits:{east:'ashwood_deep'},base:['enchanted gem','ancient rune'],mon:[M('stone_golem','Stone Golem',35,8,4,90,20,'obsidian shard')],shop:null},
  swamp_border:    {zone:'ASHWOOD FOREST',name:'Swamp Border',desc:'The floor gives way to brackish water. Serpents sun on logs.',exits:{north:'ashwood_deep',south:'swamp_heart'},base:['swamp herb'],mon:[M('swamp_serpent','Swamp Serpent',20,6,1,40,8,'serpent fang')],shop:null},
  swamp_heart:     {zone:'ASHWOOD FOREST',name:'Heart of the Swamp',desc:'A small island of dry ground in the bog. A ruined watchtower sinks into the mire. Rare deepwood roots grow here.',exits:{north:'swamp_border'},base:['obsidian shard','deepwood root'],mon:[M('bog_witch','Bog Witch',32,9,2,85,22,'void crystal')],shop:null},
  // Dungeon Upper
  // ── ASHFORD VILLAGE (second town, reachable through the forest) ────────────
  ashford_gate:    {zone:'ASHFORD VILLAGE',name:'Ashford Gate',desc:'A rickety wooden gate marks the edge of Ashford Village. Survivors of the old war settled here, tough and self-reliant. A weathered signpost points to a general store and inn.',exits:{north:'ashford_square',south:'ashwood_deep'},base:[],mon:[],shop:null},
  ashford_square:  {zone:'ASHFORD VILLAGE',name:'Ashford Square',desc:'A muddy square with a well at its centre. Villagers eye you with suspicion. A general store to the east, the Rusted Nail inn to the west, a healer to the north.',exits:{south:'ashford_gate',east:'ashford_store',west:'ashford_inn',north:'ashford_healer'},base:[],mon:[],shop:null},
  ashford_store:   {zone:'ASHFORD VILLAGE',name:'Martas General Store',desc:'Cluttered shelves of practical goods. Marta watches you with sharp eyes.',exits:{west:'ashford_square'},base:[],mon:[],shop:'ashford_store'},
  ashford_inn:     {zone:'ASHFORD VILLAGE',name:'The Rusted Nail Inn',desc:'A low-ceilinged inn smelling of woodsmoke. Old Barret the innkeeper nods from behind the bar. Rooms available for weary travellers.',exits:{east:'ashford_square'},base:[],mon:[],shop:null,inn:true},
  ashford_healer:  {zone:'ASHFORD VILLAGE',name:'Ashford Healing Post',desc:'A clean whitewashed room. Brother Finn, a gentle monk, tends a patient. Healing herbs hang drying from the rafters.',exits:{south:'ashford_square'},base:['swamp herb'],mon:[],shop:'ashford_healer'},
  ashford_outskirts:{zone:'ASHFORD VILLAGE',name:'Ashford Outskirts',desc:'Ruined buildings mark where the village once extended. Bandits have moved in. The road east leads deeper into dangerous territory.',exits:{west:'ashford_square',east:'bandit_camp'},base:[],mon:[{id:'ashford_bandit',name:'Bandit Scout',hp:22,maxhp:22,atk:6,def:2,xp:45,gold:15,loot:'crude map',dead:false}],shop:null},
  bandit_camp:     {zone:'ASHFORD VILLAGE',name:'Bandit Camp',desc:'A fortified camp of outlaws. The Bandit King rules from his throne of stolen goods.',exits:{west:'ashford_outskirts'},base:['obsidian shard','gold coin'],mon:[{id:'bandit_thug','name':'Bandit Thug',hp:30,maxhp:30,atk:8,def:3,xp:65,gold:20,loot:'iron key',dead:false},{id:'bandit_king',name:'Bandit King',hp:70,maxhp:70,atk:14,def:5,xp:300,gold:80,loot:"Bandit King's Blade",dead:false}],shop:null},
  dungeon_entrance:{zone:'THE DUNGEON — UPPER',name:'Dungeon Entrance',desc:'Iron-banded doors hang open above a descending staircase.',exits:{up:'south_gate',down:'dungeon_hall'},base:[],mon:[],shop:null},
  dungeon_hall:    {zone:'THE DUNGEON — UPPER',name:'Dungeon Hall',desc:"A vaulted corridor. Torches sputter. Aldwyn's satchel lies near the wall.",exits:{up:'dungeon_entrance',east:'crypts',west:'prison',north:'dungeon_armory',south:'dungeon_well'},base:["Aldwyn's satchel"],mon:[M('skel_warrior','Skeleton Warrior',18,5,1,35,6,'bone shard')],shop:null},
  dungeon_armory:  {zone:'THE DUNGEON — UPPER',name:'Dungeon Armory',desc:'Racks of rotted wood. One intact chest, lock smashed.',exits:{south:'dungeon_hall',north:'mid_dungeon'},base:['iron key','bone shard'],mon:[M('armor_skel','Armored Skeleton',22,6,3,50,10,'bone shard')],shop:null},
  dungeon_well:    {zone:'THE DUNGEON — UPPER',name:'The Stagnant Well',desc:'Murals depict a dark ritual — the raising of something terrible.',exits:{north:'dungeon_hall'},base:['ancient rune'],mon:[M('risen_cultist','Risen Cultist',16,5,1,30,7,'cultist robe')],shop:null},
  crypts:          {zone:'THE DUNGEON — UPPER',name:'Ancient Crypts',desc:'Row upon row of sarcophagi. Several lids pushed aside from within.',exits:{west:'dungeon_hall',north:'crypt_deep'},base:['silver ring'],mon:[M('risen_corpse','Risen Corpse',20,5,2,45,8,'grave dust')],shop:null},
  crypt_deep:      {zone:'THE DUNGEON — UPPER',name:'The Sealed Vault',desc:'An iron door blasted open from inside. A sarcophagus glows blue.',exits:{south:'crypts'},base:['void crystal'],mon:[M('crypt_lich','Crypt Lich',30,8,3,100,25,'enchanted gem')],shop:null},
  prison:          {zone:'THE DUNGEON — UPPER',name:'Prison Block',desc:'Rusted iron cells. A skeleton clutches a ring of keys.',exits:{east:'dungeon_hall'},base:[],mon:[M('ghost_guard','Prison Guard Ghost',14,4,0,30,7,'ghost essence')],shop:null},
  temple_crypt:    {zone:'THE DUNGEON — UPPER',name:'Temple Crypt',desc:'A forgotten burial crypt. Ancient runes are carved into the walls.',exits:{north:'temple',south:'mid_dungeon'},base:['ancient rune'],mon:[M('corrupt_priest','Corrupt Priest',24,6,2,55,12,'void crystal')],shop:null},
  // Dungeon Lower
  mid_dungeon:     {zone:'THE DUNGEON — LOWER',name:'The Descent',desc:'The corridor narrows. Stone older than memory. The cold is profound.',exits:{north:'dungeon_armory',south:'boss_antechamber',east:'dragon_lair',west:'void_temple',up:'temple_crypt'},base:[],mon:[M('shadow_wraith','Shadow Wraith',30,8,2,75,15,'void crystal')],shop:null},
  dragon_lair:     {zone:'THE DUNGEON — LOWER',name:"Dragon's Lair",desc:'A vast scorched cavern. A young dragon fixes burning eyes on you.',exits:{west:'mid_dungeon'},base:['dragon scale'],mon:[M('young_dragon','Young Dragon',55,12,5,180,60,'dragon scale')],shop:null},
  void_temple:     {zone:'THE DUNGEON — LOWER',name:'Void Temple',desc:'Cultists chant before an altar pulsing with violet energy.',exits:{east:'mid_dungeon'},base:['void crystal','ancient tome'],mon:[M('void_cultist','Void Cultist',25,7,2,60,14,'cultist robe'),M('void_archon','Void Archon',38,10,3,110,28,'void crystal')],shop:null},
  boss_antechamber:{zone:'THE DUNGEON — LOWER',name:'Antechamber of the Lich',desc:'Skeletal soldiers at attention. A black iron door looms north.',exits:{north:'boss_chamber',south:'mid_dungeon'},base:[],mon:[M('lich_champion',"Lich's Champion",45,11,4,150,35,'enchanted gem')],shop:null},
  boss_chamber:    {zone:'THE DUNGEON — LOWER',name:"The Lich's Chamber",desc:'Arcane sigils burn in cold blue fire. Upon a throne of bones sits the Dungeon Lich.',exits:{south:'boss_antechamber'},base:[],mon:[M('dungeon_lich','Dungeon Lich',80,14,5,500,100,"Lich's Crown")],shop:null},
  // Adventure zones
  volcanic_peak:   {zone:'VOLCANIC PEAK',name:'Crater Rim',desc:'Scorched black rock. Lava rivers below. Fire elementals patrol the ridge.',exits:{south:'volcanic_tunnels'},base:['obsidian shard'],mon:[M('fire_elem','Fire Elemental',40,10,3,110,20,'ember shard'),M('lava_golem','Lava Golem',55,13,5,160,30,'magma core')],shop:null},
  volcanic_tunnels:{zone:'VOLCANIC PEAK',name:'Superheated Tunnels',desc:'Lava-carved tunnels. Strange runes glow on the walls.',exits:{north:'volcanic_peak',south:'volcano_boss'},base:['magma core'],mon:[M('fire_imp','Fire Imp',25,7,1,60,12,'ember shard'),M('rock_wyrm','Rock Wyrm',45,11,4,130,25,'wyrm scale')],shop:null},
  volcano_boss:    {zone:'VOLCANIC PEAK',name:'The Magma Throne',desc:'The Flame Titan stirs — a fusion of molten rock and fury.',exits:{north:'volcanic_tunnels'},base:[],mon:[M('flame_titan','Flame Titan',120,18,6,800,150,"Titan's Core")],shop:null},
  frozen_tundra:   {zone:'FROZEN TUNDRA',name:'Ice Plains',desc:'A blinding white expanse. Frost wolves circle at the edges of vision.',exits:{north:'ice_fortress',east:'frozen_cave'},base:['ice shard'],mon:[M('frost_wolf','Frost Wolf',28,7,2,55,10,'frost pelt'),M('ice_wraith','Ice Wraith',35,9,1,80,15,'ghost essence')],shop:null},
  frozen_cave:     {zone:'FROZEN TUNDRA',name:'Frozen Cave',desc:'Blue-white ice. Something massive hibernates at the back.',exits:{west:'frozen_tundra'},base:['ice crystal'],mon:[M('yeti','Yeti',55,12,4,170,35,'yeti fur'),M('ice_golem','Ice Shard Golem',40,9,6,120,22,'ice shard')],shop:null},
  ice_fortress:    {zone:'FROZEN TUNDRA',name:'Ice Fortress Gates',desc:"The Frost Queen's banner hangs frozen above the arch.",exits:{south:'frozen_tundra',north:'frost_throne'},base:[],mon:[M('frost_knight','Frost Knight',50,13,5,200,40,'frost blade')],shop:null},
  frost_throne:    {zone:'FROZEN TUNDRA',name:'The Frost Throne',desc:'The Frost Queen sits encased in living ice, eyes burning pale blue.',exits:{south:'ice_fortress'},base:[],mon:[M('frost_queen','Frost Queen',110,16,7,900,200,"Frost Queen's Crown")],shop:null},
  sky_realm:       {zone:'SKY REALM',name:'Cloud Platform',desc:'Floating platforms of condensed cloud. Wind spirits drift between.',exits:{east:'storm_citadel',west:'sky_ruins'},base:['cloud essence'],mon:[M('wind_spirit','Wind Spirit',30,8,2,70,18,'wind shard'),M('thunder_hawk','Thunder Hawk',38,11,2,100,22,'storm feather')],shop:null},
  sky_ruins:       {zone:'SKY REALM',name:'Fallen Sky Ruins',desc:'Ancient ruins suspended in the sky. Stone arches float in defiance of gravity.',exits:{east:'sky_realm'},base:['ancient rune','storm feather'],mon:[M('stone_sentinel','Stone Sentinel',50,12,5,180,35,'enchanted gem')],shop:null},
  storm_citadel:   {zone:'SKY REALM',name:'Storm Citadel',desc:'The Storm God regards you with contempt.',exits:{west:'sky_realm'},base:[],mon:[M('storm_god','Storm God',130,20,5,1000,250,"Storm God's Aegis")],shop:null},
  shadow_realm:    {zone:'SHADOW REALM',name:'The Threshold',desc:'Reality tears. Shadow demons emerge from the walls themselves.',exits:{north:'void_citadel',east:'nightmare_forest'},base:['void crystal'],mon:[M('shadow_demon','Shadow Demon',45,12,3,150,30,'shadow essence'),M('nightmare_hound','Nightmare Hound',35,10,2,100,20,'nightmare fang')],shop:null},
  nightmare_forest:{zone:'SHADOW REALM',name:'Nightmare Forest',desc:'Black leafless trees. Shadows move independently. Screams echo without source.',exits:{west:'shadow_realm'},base:['shadow essence'],mon:[M('banshee','Banshee',40,11,1,130,25,'spectral dust'),M('dark_treant','Dark Treant',60,14,4,220,45,'shadow bark')],shop:null},
  void_citadel:    {zone:'SHADOW REALM',name:'Void Citadel',desc:'The Void Emperor sits on a throne of crystallised darkness.',exits:{south:'shadow_realm'},base:[],mon:[M('void_emperor','Void Emperor',150,22,7,1200,300,"Void Emperor's Sigil")],shop:null},
  crystal_caverns: {zone:'CRYSTAL CAVERNS',name:'Crystal Caverns',desc:'Towering luminescent crystal formations. Crystal golems patrol the paths.',exits:{north:'crystal_depths',east:'gem_vault'},base:['enchanted gem'],mon:[M('crystal_golem','Crystal Golem',70,16,8,280,55,'prismatic shard'),M('gem_spider','Gem Spider',50,13,4,180,35,'spider gem')],shop:null},
  gem_vault:       {zone:'CRYSTAL CAVERNS',name:'The Gem Vault',desc:'A natural vault packed with raw gemstones.',exits:{west:'crystal_caverns'},base:['prismatic shard','void crystal'],mon:[M('diamond_guardian','Diamond Guardian',85,18,10,350,70,'diamond core')],shop:null},
  crystal_depths:  {zone:'CRYSTAL CAVERNS',name:'Crystalline Depths',desc:'The Prism Titan — ancient guardian of the caverns — rises from the floor.',exits:{south:'crystal_caverns'},base:[],mon:[M('prism_titan','Prism Titan',160,22,9,1400,320,"Prism Titan's Core")],shop:null},
  haunted_keep:    {zone:'HAUNTED KEEP',name:'Keep Courtyard',desc:'Wailing spirits patrol the overgrown courtyard.',exits:{north:'keep_great_hall',east:'keep_dungeons'},base:['ghost essence'],mon:[M('wailing_specter','Wailing Specter',75,18,4,300,60,'spectral dust'),M('cursed_knight','Cursed Knight',90,21,8,380,75,'cursed blade')],shop:null},
  keep_dungeons:   {zone:'HAUNTED KEEP',name:'Keep Dungeons',desc:'The underground cells still hold their prisoners — undead ones.',exits:{west:'haunted_keep'},base:['ancient rune'],mon:[M('chained_revenant','Chained Revenant',80,19,5,320,65,'revenant dust'),M('bone_horror','Bone Horror',95,22,6,400,80,'cursed bone')],shop:null},
  keep_great_hall: {zone:'HAUNTED KEEP',name:'The Great Hall',desc:'At the head table sits the Death Baron — lord of the keep.',exits:{south:'haunted_keep'},base:[],mon:[M('death_baron','Death Baron',190,25,10,1600,380,"Death Baron's Crown")],shop:null},
  astral_sea:      {zone:'ASTRAL SEA',name:'Astral Sea Shallows',desc:'An infinite ocean of silver light between the planes.',exits:{north:'astral_depths',west:'astral_wreckage'},base:['cloud essence','void crystal'],mon:[M('astral_shark','Astral Shark',90,22,6,380,80,'astral fin'),M('plane_walker','Plane Walker',75,20,8,320,65,'astral essence')],shop:null},
  astral_wreckage: {zone:'ASTRAL SEA',name:'Astral Wreckage',desc:'Remains of civilisations lost between planes. Githyanki pirates board the wrecks.',exits:{east:'astral_sea'},base:['enchanted gem','ancient tome'],mon:[M('githyanki','Githyanki Pirate',85,21,7,360,75,'silver sword')],shop:null},
  astral_depths:   {zone:'ASTRAL SEA',name:'The Astral Vortex',desc:'A churning vortex of planar energy. The Astral Leviathan circles endlessly.',exits:{south:'astral_sea'},base:[],mon:[M('astral_leviathan','Astral Leviathan',210,28,10,1800,420,"Leviathan's Scale")],shop:null},
  void_sanctum:    {zone:'VOID SANCTUM',name:'Void Sanctum Antechamber',desc:'Beyond the edges of existence. Void wraiths guard the passage.',exits:{north:'sanctum_inner',east:'void_library'},base:['void crystal','shadow essence'],mon:[M('void_wraith','Void Wraith',110,26,8,500,100,'void essence'),M('null_horror','Null Horror',130,28,9,600,120,'void crystal')],shop:null},
  void_library:    {zone:'VOID SANCTUM',name:'Library of the Void',desc:'Every book ever lost, consumed by the void. Scholars guard it jealously.',exits:{west:'void_sanctum'},base:['ancient tome','ancient rune'],mon:[M('void_scholar','Void Scholar',100,24,10,450,90,'forbidden tome')],shop:null},
  sanctum_inner:   {zone:'VOID SANCTUM',name:'Inner Sanctum — The Nothing',desc:'The Void God — the primordial emptiness given terrible consciousness — waits here.',exits:{south:'void_sanctum'},base:[],mon:[M('void_god','Void God',250,32,12,2500,500,"Void God's Essence")],shop:null}
};

const TELEPORT_ZONES = {
  '1':{dest:'volcanic_peak', name:'Volcanic Peak',  lvl:3,  boss:'Flame Titan',     threat:'Extreme heat, fire elementals.'},
  '2':{dest:'frozen_tundra', name:'Frozen Tundra',  lvl:4,  boss:'Frost Queen',     threat:'Frost damage, slow effects.'},
  '3':{dest:'sky_realm',     name:'Sky Realm',      lvl:5,  boss:'Storm God',       threat:'Lightning storms, high winds.'},
  '4':{dest:'shadow_realm',  name:'Shadow Realm',   lvl:7,  boss:'Void Emperor',    threat:'Necrotic damage, fear effects.'},
  '5':{dest:'crystal_caverns',name:'Crystal Caverns',lvl:8, boss:'Prism Titan',     threat:'Crystal shards, high DEF foes.'},
  '6':{dest:'haunted_keep',  name:'Haunted Keep',   lvl:10, boss:'Death Baron',     threat:'Undead enemies, curse effects.'},
  '7':{dest:'astral_sea',    name:'Astral Sea',     lvl:12, boss:'Astral Leviathan',threat:'Planar damage, void effects.'},
  '8':{dest:'void_sanctum',  name:'Void Sanctum',   lvl:15, boss:'Void God',        threat:'Reality unravels. Maximum danger.'}
};


// ── Live world state ──────────────────────────────────────────────────────
let world = {};
function initWorld() {
  world = {};
  for (const [id, t] of Object.entries(WT)) {
    world[id] = {
      ...t,
      exits: {...(t.exits||{})},  // deep copy exits so they can't be mutated
      items: [...(t.base||[])],
      monsters: (t.mon||[]).map(m => ({...m}))
    };
  }
  console.log('[Boot] World ready —', Object.keys(world).length, 'rooms');
}
function respawnWorld() {
  let n = 0;
  for (const [id, t] of Object.entries(WT)) {
    const rm = world[id];
    (t.mon||[]).forEach(tm => {
      const live = rm.monsters.find(m => m.id === tm.id);
      if (!live || live.dead) {
        const i = rm.monsters.findIndex(m => m.id === tm.id);
        const nm = {...tm, hp:tm.maxhp, dead:false};
        if (i >= 0) rm.monsters[i] = nm; else rm.monsters.push(nm);
        n++;
      }
    });
    (t.base||[]).forEach(item => { if (!rm.items.includes(item)) { rm.items.push(item); n++; } });
  }
  if (n > 0) bAll({type:'line',text:'[ The world stirs — monsters and items respawned. ]',cls:'sys'});
}
initWorld();
setInterval(respawnWorld, 5*60*1000);

// ── Guilds ────────────────────────────────────────────────────────────────
let guilds = {};
function loadGuilds() { try { if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true}); guilds = JSON.parse(fs.readFileSync(GUILD_FILE,'utf8')); } catch { guilds = {}; } }
function saveGuilds() { fs.writeFileSync(GUILD_FILE, JSON.stringify(guilds,null,2)); }
loadGuilds();
console.log('[Boot] Guilds loaded —', Object.keys(guilds).length, 'guilds');


// ── Housing / Room Rental ─────────────────────────────────────────────────
const HOUSING_FILE = path.join(DATA_DIR, 'housing.json');
let rentedRooms = {}; // username -> {roomId, expires, items:[]}
function loadHousing(){try{rentedRooms=JSON.parse(fs.readFileSync(HOUSING_FILE,'utf8'));}catch{rentedRooms={};}}
function saveHousing(){try{fs.writeFileSync(HOUSING_FILE,JSON.stringify(rentedRooms,null,2));}catch(e){console.error('[HOUSING]',e.message);}}
loadHousing();

const RENTAL_COST = 50; // gold per rent
const RENTAL_DAYS = 7;  // days per rental

function housingCmd(ws,p,sub,rest){
  const inns=['tavern','ashford_inn'];
  switch(sub){
    case'rent':{
      if(!inns.includes(p.room))return say(ws,'You must be at a tavern inn to rent a room. (The Broken Flagon in Shadowmere or The Rusted Nail in Ashford)','err');
      if(rentedRooms[p.username])return say(ws,'You already rent a room. Type ROOM to enter it.','ok');
      if(p.gold<RENTAL_COST)return say(ws,`Need ${RENTAL_COST}g to rent a room for ${RENTAL_DAYS} days.`,'err');
      p.gold-=RENTAL_COST;
      const roomId='private_'+p.username.toLowerCase();
      const expires=Date.now()+(RENTAL_DAYS*24*60*60*1000);
      rentedRooms[p.username]={roomId,expires,items:[],desc:'A small but private room. A bed, a table, a window.'};
      world[roomId]={zone:'PRIVATE QUARTERS',name:`${p.name}'s Room`,
        desc:'A small private room. Your own space in Shadowmere. STORE [item] to leave items here. RETRIEVE [item] to take them.',
        exits:{out:p.room},base:[],mon:[],shop:null,private:p.username};
      saveHousing();svc(p);sidebar(ws,p);
      say(ws,`Room rented for ${RENTAL_DAYS} days. ${RENTAL_COST}g paid. Type ROOM to enter.`,'ok');
      break;
    }
    case'enter':case'':case undefined:{
      const rental=rentedRooms[p.username];
      if(!rental)return say(ws,'No room rented. Visit a tavern: HOUSING RENT costs 50g for 7 days.','err');
      if(Date.now()>rental.expires){
        delete rentedRooms[p.username];
        if(world[rental.roomId])delete world[rental.roomId];
        saveHousing();
        return say(ws,'Your room rental has expired. Visit a tavern to renew (HOUSING RENT).','err');
      }
      // Ensure room exists in world
      if(!world[rental.roomId]){
        world[rental.roomId]={zone:'PRIVATE QUARTERS',name:`${p.name}'s Room`,
          desc:'A small private room.',exits:{out:inns.includes(p.room)?p.room:'tavern'},base:[],mon:[],shop:null,private:p.username};
      }
      world[rental.roomId].exits.out=p.room;
      p.room=rental.roomId;describeRoom(ws,p);
      const days=Math.ceil((rental.expires-Date.now())/(24*60*60*1000));
      say(ws,`  Rental expires in ${days} day(s). HOUSING RENEW to extend.`,'sys');
      if(rental.items&&rental.items.length)say(ws,`  Stored items: ${rental.items.join(', ')}`,'loot');
      sidebar(ws,p);break;
    }
    case'renew':{
      const rental=rentedRooms[p.username];
      if(!rental)return say(ws,'No room rented. Type HOUSING RENT at a tavern.','err');
      if(p.gold<RENTAL_COST)return say(ws,`Need ${RENTAL_COST}g to renew.`,'err');
      p.gold-=RENTAL_COST;
      rental.expires=Math.max(rental.expires,Date.now())+(RENTAL_DAYS*24*60*60*1000);
      saveHousing();svc(p);sidebar(ws,p);
      say(ws,`Room renewed for another ${RENTAL_DAYS} days.`,'ok');break;
    }
    case'store':{
      const rental=rentedRooms[p.username];
      if(!rental||p.room!==rental.roomId)return say(ws,'You must be in your room to store items. HOUSING ENTER first.','err');
      if(!rest)return say(ws,'HOUSING STORE [item]','err');
      const idx=p.inventory.findIndex(i=>i.toLowerCase().includes(rest.toLowerCase()));
      if(idx===-1)return say(ws,"You don't have that.",'err');
      const item=p.inventory.splice(idx,1)[0];
      if(!rental.items)rental.items=[];rental.items.push(item);
      saveHousing();svc(p);sidebar(ws,p);
      say(ws,`${item} stored in your room.`,'ok');break;
    }
    case'retrieve':{
      const rental=rentedRooms[p.username];
      if(!rental||p.room!==rental.roomId)return say(ws,'You must be in your room to retrieve items.','err');
      if(!rest)return say(ws,'HOUSING RETRIEVE [item]','err');
      const idx=(rental.items||[]).findIndex(i=>i.toLowerCase().includes(rest.toLowerCase()));
      if(idx===-1)return say(ws,"That item is not stored here.",'err');
      const item=rental.items.splice(idx,1)[0];
      p.inventory.push(item);saveHousing();svc(p);sidebar(ws,p);
      say(ws,`${item} retrieved.`,'ok');break;
    }
    default:say(ws,'HOUSING: RENT  ENTER  RENEW  STORE [item]  RETRIEVE [item]','sys');
  }
}


// ── Class Specialization (every 10 levels, choose 2 of 5 offered skills) ──
const SPEC_POOL = {
  // Tank specs
  warrior:    ['divine_shield','fortress','consecrate','unholy_ground','bone_shield'],
  paladin:    ['meteor','chain_lightning','holy_nova','purge','inspire'],
  templar:    ['rage','blood_lust','death_strike','reckless_strike','war_cry'],
  deathknight:['plague','soul_drain','lich_form','doom','dark_pact'],
  // Damage specs
  rogue:      ['death_mark','shadow_strike','confuse','wild_magic','jinx'],
  berserker:  ['meteor','chain_lightning','fireball','spell_surge','overload'],
  shadowblade:['poison_blade','death_mark','soul_siphon','banish','doom'],
  warlock:    ['plague','curse_skill','hex','death_mark','unholy_ground'],
  // Magic specs
  mage:       ['chain_lightning','soul_rend','rift','overload','elemental_form'],
  shaman:     ['fireball','meteor','consecrate','regrowth','totem'],
  channeler:  ['holy_nova','dark_aura','inspire','catalyst','purge'],
  spellblade: ['shadow_strike','death_mark','dark_aura','soul_rend','doom'],
  // Support specs
  druid:      ['lay_on_hands','divine_shield','consecrate','inspire','fortress'],
  alchemist:  ['regrowth','totem','ancestral_shield','purge','nature_heal'],
  monk:       ['blood_lust','rage','reckless_strike','war_cry','frenzy'],
  // Summoner specs
  beastmaster:['summon_wolves','entangle','barkskin','alpha_call','wild_instinct'],
  zombie_mage:['doom','dark_pact','plague','unholy_ground','soul_rend'],
  necromancer:['meteor','chain_lightning','fireball','hex','banish'],
  // Misc
  ranger:     ['shadowstep','blink','fade','death_mark','shadow_strike'],
  trickster:  ['meteor','fireball','chain_lightning','doom','plague']
};

function offerSpecialization(ws,p){
  if(!p.pendingSpec){p.pendingSpec=null;}
  const pool=SPEC_POOL[p.classId]||[];
  // Filter out skills already learned
  const available=pool.filter(s=>!(p.extraSkills||[]).includes(s));
  if(available.length<2){say(ws,'No new specializations available for your class at this time.','sys');return;}
  // Pick 5 random from available (or all if less)
  const offered=available.sort(()=>Math.random()-0.5).slice(0,Math.min(5,available.length));
  p.pendingSpec={offered,chosen:[]};
  say(ws,'','sys');
  say(ws,'★ ═══ CLASS SPECIALIZATION ══════════════════════════════ ★','loot');
  say(ws,`You have reached a milestone! Choose 2 new skills to learn:`,'ok');
  offered.forEach((sid,i)=>{
    const sk=SK[sid]||{n:sid};
    say(ws,`  [${i+1}] ${sk.n.padEnd(20)} ${sk.cmb?'(combat)':'(any time)'}`,  'skill');
  });
  say(ws,'Type CHOOSE [1] then CHOOSE [2] to select your two skills.','sys');
  say(ws,'★ ════════════════════════════════════════════════════════ ★','loot');
}

function doChooseSpec(ws,p,numStr){
  if(!p.pendingSpec)return say(ws,'No specialization pending. You earn one every 10 levels.','err');
  const n=parseInt(numStr)-1;
  if(isNaN(n)||n<0||n>=p.pendingSpec.offered.length)return say(ws,`Choose a number between 1 and ${p.pendingSpec.offered.length}.`,'err');
  const sid=p.pendingSpec.offered[n];
  if(p.pendingSpec.chosen.includes(sid))return say(ws,'Already chosen that one.','err');
  p.pendingSpec.chosen.push(sid);
  const sk=SK[sid]||{n:sid};
  say(ws,`✓ Learned: ${sk.n}!`,'loot');
  if(p.pendingSpec.chosen.length>=2){
    // Apply the skills
    if(!p.extraSkills)p.extraSkills=[];
    p.pendingSpec.chosen.forEach(s=>{if(!p.extraSkills.includes(s))p.extraSkills.push(s);});
    p.pendingSpec=null;
    say(ws,'★ Specialization complete! Your new skills are ready to use.','loot');
    svc(p);sidebar(ws,p);
  }else{
    say(ws,'Good. Now choose your second skill.','sys');
  }
}


// ── Leaderboards ──────────────────────────────────────────────────────────
function showLeaderboard(ws,cat){
  cat=(cat||'level').toLowerCase();
  // Load all character files
  const chars=[];
  try{
    fs.readdirSync(CHAR_DIR).filter(f=>f.endsWith('.json')).forEach(f=>{
      try{const c=JSON.parse(fs.readFileSync(path.join(CHAR_DIR,f),'utf8'));chars.push(c);}catch{}
    });
  }catch{}
  let sorted,title,val;
  if(cat==='kills'||cat==='kill'){sorted=chars.sort((a,b)=>(b.killCount||0)-(a.killCount||0));title='Top Monster Slayers';val=c=>`${c.killCount||0} kills`;}
  else if(cat==='gold'||cat==='rich'){sorted=chars.sort((a,b)=>(b.gold||0)-(a.gold||0));title='Richest Adventurers';val=c=>`${c.gold||0}g`;}
  else if(cat==='achieve'||cat==='achievements'){sorted=chars.sort((a,b)=>(b.achievements||[]).length-(a.achievements||[]).length);title='Most Achievements';val=c=>`${(c.achievements||[]).length} achievements`;}
  else{sorted=chars.sort((a,b)=>(b.level||1)-(a.level||1));title='Highest Level';val=c=>`Level ${c.level||1}`;}
  say(ws,'═══ Shadowmere Leaderboard — '+title+' ═══════════════','loot');
  sorted.slice(0,10).forEach((c,i)=>{
    const online=[...sessions.values()].find(x=>x.username===c.username&&x.loggedIn);
    say(ws,`  ${String(i+1).padStart(2)}. ${c.name.padEnd(16)} ${c.raceName||''} ${c.className} — ${val(c)}${online?' ●':''}`,i===0?'loot':'sys');
  });
  say(ws,'  LEADERS [level/kills/gold/achievements] to filter','sys');
}


// ── Quest Chain Extensions (unlock after base quests) ────────────────────
const QUEST_CHAINS = {
  // Tormund chain: rats -> missing merchant -> investigate dungeon
  tavern_investigation:{id:'tavern_investigation',giver:'tormund',title:'Something Rotten',
    unlocks_after:'missing_merchant',
    obj:'Investigate the Void Temple in the dungeon lower level.',
    reward:{gold:200,xp:400,item:'Greater Heal'},
    start:"Tormund lowers his voice. 'Aldwyn wasn't the first to disappear. Three merchants in a month. Something in that dungeon is drawing them in. The Void Temple in the lower levels — I heard cultists whispering about it. Will you investigate?'",
    progress:"Tormund: 'The Void Temple — lower dungeon, west of the mid passage. Report back.'",
    complete:"Tormund lets out a long breath. 'So it is the cultists. Void worshippers. I feared as much. Take this — and watch your back out there.'",
    check:p=>(p.zonesVisited||[]).includes('void_temple')||p.room==='void_temple'},

  // Mira chain: herbs -> venom -> rare ingredient
  mira_deepwood:{id:'mira_deepwood',giver:'mira',title:'The Deepwood Root',
    unlocks_after:'mira_venom',
    obj:'Find the deepwood root in the Heart of the Swamp and return it to Mira.',
    reward:{gold:100,xp:200,item:'Full Restore'},
    start:"Mira leans forward. 'With the serpent venom and the right catalyst I can make something truly powerful. There is a root that only grows in the deepest swamp. I have not been able to retrieve it. Would you try?'",
    progress:"Mira: 'The deepwood root. Heart of the swamp — south through the forest border.'",
    complete:"Mira examines the root carefully, eyes bright. 'Perfect specimen. This will last me months.' She hands you a beautifully prepared full restoration draught. 'My finest work.'",
    check:p=>p.inventory.some(i=>i.toLowerCase()==='deepwood root')},

  // Aldric chain: blessing -> relic -> purge the lich
  aldric_crusade:{id:'aldric_crusade',giver:'aldric',title:"The Crusade",
    unlocks_after:'aldric_relic',
    obj:'Defeat the Dungeon Lich and return to Father Aldric.',
    reward:{gold:500,xp:1000,item:"Aldric's Blessing"},
    start:"Aldric stands straighter than before. 'The relic is restored. Now the temple has power again. Use it — take this blessed oil and anoint your weapon before you face the Lich. Only a blessed blade can truly end this curse. Will you go?'",
    progress:"Aldric: 'The Dungeon Lich awaits. Go north through the south gate, down to the dungeon, through to the lower levels. The standing stones will guide you.'",
    complete:"Aldric falls to his knees in prayer, tears streaming. 'It is done. The curse is broken.' He rises and places his hands on your shoulders. 'You have saved this town. The Fallen bless you always.'",
    check:p=>(p.achievements||[]).includes('lich_slayer')}
};

// Register chain items in EQ
EQ["aldric's blessing"]={t:'trinket',atk:5,def:5,desc:"Father Aldric's holy blessing, made physical. Radiates warmth and light."};
EQ['deepwood root']={t:'item',atk:0,def:0,desc:'A gnarled root with potent alchemical properties.'};

// Add deepwood root to swamp_heart

// Notice Board
const notices = [];
function addNotice(author,text){
  notices.unshift({author,text,ts:new Date().toLocaleDateString()});
  if(notices.length>20)notices.pop();
  bAll({type:'line',text:'[Notice Board] '+author+': '+text,cls:'loot'});
}
function showBoard(ws){
  say(ws,'=== Shadowmere Notice Board ========================','loot');
  if(!notices.length)say(ws,'  Empty. POST [message] to add a notice.','sys');
  else notices.forEach((n,i)=>say(ws,'  ['+(i+1)+'] '+n.author+' ('+n.ts+'): '+n.text,'sys'));
  say(ws,'  POST [message] to pin a notice.  BOARD to view.','sys');
}


// ── Auction House ─────────────────────────────────────────────────────────
const AUCTION_FILE = path.join(DATA_DIR, 'auction.json');
let auctionItems = []; // {id, seller, item, price, listed}
let auctionSeq = 1;
function loadAuction(){try{const d=JSON.parse(fs.readFileSync(AUCTION_FILE,'utf8'));auctionItems=d.items||[];auctionSeq=d.seq||1;}catch{auctionItems=[];auctionSeq=1;}}
function saveAuction(){try{if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(AUCTION_FILE,JSON.stringify({items:auctionItems,seq:auctionSeq},null,2));}catch(e){console.error('[AUCTION SAVE]',e.message);}}
loadAuction();

function auctionCmd(ws,p,sub,rest){
  switch(sub){
    case'list':case'browse':case'':case undefined:{
      say(ws,'═══ Auction House ══════════════════════════════','loot');
      if(!auctionItems.length)return say(ws,'  No items listed. AUCTION SELL [item] [price] to list one.','sys');
      auctionItems.forEach((a,i)=>{
        const eq=EQ[a.item.toLowerCase()];
        const stats=eq?` [${eq.t} ATK+${eq.atk} DEF+${eq.def}]`:'';
        say(ws,`  [${a.id}] ${a.item}${stats} — ${a.price}g  (seller: ${a.seller})${a.seller===p.name?' [YOURS]':''}`,a.seller===p.name?'ok':'sys');
      });
      say(ws,'  AUCTION BUY [#] to purchase.  AUCTION CANCEL [#] to remove your listing.','sys');
      break;
    }
    case'sell':{
      const parts=rest.split(' ');
      const priceStr=parts[parts.length-1];
      const price=parseInt(priceStr);
      if(isNaN(price)||price<1)return say(ws,'Usage: AUCTION SELL [item name] [price]  e.g. AUCTION SELL Iron Sword 50','err');
      const itemQ=parts.slice(0,-1).join(' ');
      const idx=p.inventory.findIndex(i=>i.toLowerCase().includes(itemQ.toLowerCase()));
      if(idx===-1)return say(ws,`You don't have "${itemQ}" in your inventory.`,'err');
      if(auctionItems.filter(a=>a.seller===p.name).length>=5)return say(ws,'You can only list 5 items at a time. Cancel one first.','err');
      const item=p.inventory.splice(idx,1)[0];
      const listing={id:auctionSeq++,seller:p.name,item,price,listed:new Date().toLocaleDateString()};
      auctionItems.push(listing);
      saveAuction();svc(p);sidebar(ws,p);
      say(ws,`Listed ${item} for ${price}g on the Auction House. [Listing #${listing.id}]`,'ok');
      bAll({type:'line',text:`📦 ${p.name} listed ${item} on the Auction House for ${price}g!`,cls:'loot'});
      break;
    }
    case'buy':{
      const id=parseInt(rest);
      if(isNaN(id))return say(ws,'Usage: AUCTION BUY [#]  — use AUCTION LIST to see item numbers.','err');
      const idx=auctionItems.findIndex(a=>a.id===id);
      if(idx===-1)return say(ws,`Listing #${id} not found.`,'err');
      const listing=auctionItems[idx];
      if(listing.seller===p.name)return say(ws,"You can't buy your own listing. Use AUCTION CANCEL to remove it.",'err');
      if(p.gold<listing.price)return say(ws,`Need ${listing.price}g — you have ${p.gold}g.`,'err');
      p.gold-=listing.price;
      p.inventory.push(listing.item);
      auctionItems.splice(idx,1);
      // Pay seller if online
      const seller=[...sessions.values()].find(x=>x.loggedIn&&x.name===listing.seller);
      if(seller){seller.gold+=listing.price;svc(seller);sidebar(seller.ws,seller);say(seller.ws,`📦 ${p.name} bought your ${listing.item} for ${listing.price}g!`,'loot');}
      else{
        // Save gold to seller's file for when they next log in
        const sd=ldc(listing.seller.toLowerCase());
        if(sd){sd.gold=(sd.gold||0)+listing.price;try{fs.writeFileSync(cf(listing.seller.toLowerCase()),JSON.stringify(sd,null,2));}catch{}}
      }
      saveAuction();svc(p);sidebar(ws,p);
      say(ws,`Purchased ${listing.item} for ${listing.price}g!`,'ok');
      const eq=EQ[listing.item.toLowerCase()];
      if(eq)say(ws,`  [${eq.t.toUpperCase()}] ATK+${eq.atk} DEF+${eq.def} — EQUIP ${listing.item} to use it.`,'sys');
      bAll({type:'line',text:`📦 ${p.name} bought ${listing.item} from ${listing.seller} at the Auction House!`,cls:'loot'});
      break;
    }
    case'cancel':{
      const id=parseInt(rest);
      if(isNaN(id))return say(ws,'Usage: AUCTION CANCEL [#]','err');
      const idx=auctionItems.findIndex(a=>a.id===id&&a.seller===p.name);
      if(idx===-1)return say(ws,`Listing #${id} not found or not yours.`,'err');
      const item=auctionItems.splice(idx,1)[0].item;
      p.inventory.push(item);
      saveAuction();svc(p);sidebar(ws,p);
      say(ws,`Listing cancelled. ${item} returned to your inventory.`,'ok');
      break;
    }
    default:say(ws,'Auction: LIST  SELL [item] [price]  BUY [#]  CANCEL [#]','sys');
  }
}


// ── Day/Night Cycle & Weather ─────────────────────────────────────────────
const WEATHER_TYPES = ['clear','clear','clear','rain','rain','storm','fog','fog'];
const TIMES = ['dawn','morning','afternoon','dusk','evening','night','midnight','deep night'];
let gameHour = new Date().getHours() % 8; // 0-7 maps to 8 time periods
let weather = 'clear';
let isNight = false;

function updateDayNight(){
  gameHour = (gameHour+1) % 8;
  isNight = gameHour >= 4; // evening through deep night
  weather = WEATHER_TYPES[Math.floor(Math.random()*WEATHER_TYPES.length)];
  const timeStr = TIMES[gameHour];
  const weatherStr = weather==='clear'?'The skies are clear.':weather==='rain'?'Rain falls steadily.':weather==='storm'?'A fierce storm rages!':'A thick fog rolls in.';
  const msg = `[ ${timeStr.toUpperCase()} — ${weatherStr}${isNight?' Night creatures stir.':' Daylight holds.'} ]`;
  bAll({type:'line',text:msg,cls:'narrate'});
  if(weather==='clear'&&!isNight){
    // Clear day XP bonus announcement
    bAll({type:'line',text:'[ Clear skies — +10% XP bonus for the next hour! ]',cls:'ok'});
  }
  if(weather==='storm'){
    bAll({type:'line',text:'[ STORM WARNING — Outdoor areas more dangerous! ]',cls:'err'});
  }
  console.log(`[Time] ${timeStr}, weather: ${weather}, night: ${isNight}`);
}

// Night-only monsters (added to outdoor rooms at night)
const NIGHT_MONSTERS = [
  {id:'shadow_stalker',name:'Shadow Stalker',hp:35,maxhp:35,atk:10,def:2,xp:85,gold:18,loot:'shadow essence'},
  {id:'night_horror',name:'Night Horror',  hp:28,maxhp:28,atk:12,def:1,xp:70,gold:15,loot:'nightmare fang'}
];
const OUTDOOR_ROOMS = ['ashwood_edge','ashwood_deep','forest_camp','forest_ruins','swamp_border','swamp_heart','south_gate','town_square'];

function applyNightMonsters(){
  OUTDOOR_ROOMS.forEach(rid=>{
    if(!world[rid])return;
    if(isNight){
      NIGHT_MONSTERS.forEach(nm=>{
        if(!world[rid].monsters.find(m=>m.id===nm.id))
          world[rid].monsters.push({...nm,dead:false});
      });
    }else{
      world[rid].monsters=world[rid].monsters.filter(m=>!NIGHT_MONSTERS.find(n=>n.id===m.id));
    }
  });
}

// Run every real hour
setInterval(()=>{updateDayNight();applyNightMonsters();}, 60*60*1000);
// Initial call happens after sessions is defined (see bottom of file)

function getTimeWeather(){return {hour:TIMES[gameHour],weather,isNight};}

// ── Parties ───────────────────────────────────────────────────────────────
const parties = new Map();
let partySeq = 0;
function getParty(username) {
  for (const [id, party] of parties) {
    if (party && party.members && party.members.has(username)) return {id, ...party};
  }
  return null;
}

// ── Sessions ──────────────────────────────────────────────────────────────
const sessions = new Map();
const inRoom = rid => [...sessions.values()].filter(p => p.room === rid && p.loggedIn);
function bRoom(rid, msg, excl=null) {
  for (const [ws, p] of sessions)
    if (p.room===rid && p.loggedIn && ws!==excl && ws.readyState===WS.OPEN)
      ws.send(JSON.stringify(msg));
}
function bAll(msg) {
  if(!sessions)return;
  for (const [ws, p] of sessions)
    if (p.loggedIn && ws.readyState===WS.OPEN)
      ws.send(JSON.stringify(msg));
}
function raw(ws, msg) { if (ws.readyState===WS.OPEN) ws.send(JSON.stringify(msg)); }
function say(ws, text, cls='') { raw(ws, {type:'line', text, cls}); }
function sayRoom(rid, text, cls='', excl=null) { bRoom(rid, {type:'line',text,cls}, excl); }

// ── Character files ───────────────────────────────────────────────────────
const cf  = u => path.join(CHAR_DIR, u.toLowerCase()+'.json');
const cex = u => fs.existsSync(cf(u));
const ldc = u => { try { if(!fs.existsSync(cf(u)))return null; return JSON.parse(fs.readFileSync(cf(u),'utf8')); } catch { return null; } };
function svc(p) {
  try{
  // Ensure directory exists before writing
  if(!fs.existsSync(CHAR_DIR))fs.mkdirSync(CHAR_DIR,{recursive:true});
  if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});
  fs.writeFileSync(cf(p.username), JSON.stringify({
    username:p.username, passwordHash:p.passwordHash, name:p.name,
    raceId:p.raceId, raceName:p.raceName, classId:p.classId, className:p.className,
    hp:p.hp, maxhp:p.maxhp, atk:p.atk, def:p.def, gold:p.gold, xp:p.xp, level:p.level,
    inventory:p.inventory, equipped:p.equipped, gearAtk:p.gearAtk, gearDef:p.gearDef,
    room:p.room, cd:p.cd||{}, companion:p.companion||null, zombies:p.zombies||[],
    bio:p.bio||'', avatar:p.avatar||'', achievements:p.achievements||[],
    killCount:p.killCount||0, craftCount:p.craftCount||0,
    zonesVisited:p.zonesVisited||[], guildId:p.guildId||'',
    quests:p.quests||{}, isAdmin:p.isAdmin||false, bagContents:p.bagContents||{}, autoloot:!!p.autoloot, aliases:p.aliases||{}, extraSkills:p.extraSkills||[]
  }, null, 2));
  }catch(e){console.error('[SAVE ERROR]',e.message);}
}

const RTDEF = {
  loggedIn:false, inCombat:false, enemy:null, dead:false, ws:null,
  atkBonus:0, sh:{}, cd:{}, backstabUsed:false, partyFollow:false,
  bcT:0, bcV:0, pbT:0, pbD:0, frozenT:0, rageT:0, rageA:0,
  shiftT:0, _shiftActive:false, lichT:0, _lichActive:false,
  consecT:0, regrowthT:0, totemT:0, totemH:0, plagueT:0, plagueD:0,
  curseT:0, curseD:0, darkpactT:0, doomT:0, darkAuraT:0,
  deathmarkT:0, elementalT:0, _elementalActive:false,
  catalystT:0, _catalystActive:false, inspireT:0, _inspireActive:false,
  _darkPactActive:false, _arcaneBladeActive:false,
  regenTimer:900, bio:'', avatar:'', achievements:[], killCount:0, bagContents:{}, autoloot:false, aliases:{}, extraSkills:[],
  craftCount:0, zonesVisited:[], guildId:'', quests:{}, isAdmin:false,
  companion:null, zombies:[]
};

function newPlayer(user, pw, name, raceId, classId) {
  const race = RACES[raceId], cls = CLASSES[classId];
  const p = {
    ...RTDEF,
    username:user, passwordHash:hash(pw), name, raceId, raceName:race.name,
    classId, className:cls.name,
    hp:cls.hp+race.hp, maxhp:cls.hp+race.hp,
    atk:cls.atk+race.atk, def:cls.def+race.def,
    gold:cls.gold+race.gold, xp:0, level:1,
    inventory:[], equipped:[], gearAtk:0, gearDef:0,
    room:'town_square', cd:{}, companion:null, zombies:[]
  };
  (cls.start||[]).forEach(item => {
    p.inventory.push(item);
    const k = item.toLowerCase();
    if (EQ[k]) doEquip(p, item, true);
  });
  return p;
}
function hydrate(data) { return Object.assign({...RTDEF, companion:null, zombies:[]}, data); }

// Admin account
const ADMIN_USER = 'bound';
const ADMIN_HASH = hash('78945');
function ensureAdmin() {
  try{
  if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});
  if(!fs.existsSync(CHAR_DIR))fs.mkdirSync(CHAR_DIR,{recursive:true});
  if (cex(ADMIN_USER)) return;
  fs.writeFileSync(cf(ADMIN_USER), JSON.stringify({
    username:ADMIN_USER, passwordHash:ADMIN_HASH, name:'Bound',
    raceId:'celestial', raceName:'Celestial', classId:'templar', className:'Templar',
    hp:9999, maxhp:9999, atk:99, def:99, gold:999999, xp:0, level:99,
    inventory:[], equipped:[], gearAtk:0, gearDef:0, room:'town_square',
    cd:{}, companion:null, zombies:[], bio:'Administrator of Shadowmere.',
    avatar:'', achievements:[], killCount:0, craftCount:0, zonesVisited:[],
    guildId:'', quests:{}, isAdmin:true
  }, null, 2));
  console.log('[Boot] Admin account "Bound" created');
  }catch(e){console.error('[ADMIN SETUP ERROR]',e.message);}
}
ensureAdmin();
console.log('[Boot] Admin ready');


// ── Equip helpers ─────────────────────────────────────────────────────────
function doEquip(p, name, silent) {
  const k = name.toLowerCase(), st = EQ[k];
  if (!st) return false;
  if (p.equipped.includes(name)) return false;
  // Bags don't replace other items — multiple bags allowed
  if (st.t !== 'bag') {
    const old = p.equipped.find(e => {
      const es = EQ[e.toLowerCase()];
      return es && es.t === st.t;
    });
    if (old) doUnequip(p, old, true);
  }
  p.equipped.push(name);
  p.inventory = p.inventory.filter(i => i !== name);
  p.atk += (st.atk||0); p.def += (st.def||0);
  p.gearAtk += (st.atk||0); p.gearDef += (st.def||0);
  return true;
}
function doUnequip(p, name, silent) {
  const i = p.equipped.indexOf(name); if (i === -1) return false;
  const st = EQ[name.toLowerCase()];
  p.equipped.splice(i, 1); p.inventory.push(name);
  if (st) { p.atk-=(st.atk||0); p.def-=(st.def||0); p.gearAtk-=(st.atk||0); p.gearDef-=(st.def||0); }
  return true;
}

// ── Regen tick — full heal every 15 minutes ─────────────────────────────
const REGEN_SECS = 15 * 60; // 900 seconds = 15 minutes
setInterval(() => {
  for (const [ws, p] of sessions) {
    if (!p.loggedIn || p.dead) continue;
    if (p.regenTimer === undefined) p.regenTimer = REGEN_SECS;
    p.regenTimer--;
    if (p.regenTimer <= 0) {
      p.regenTimer = REGEN_SECS;
      if (p.hp < p.maxhp) {
        p.hp = p.maxhp;
        say(ws, `[ ✦ Natural rest — HP fully restored! HP: ${p.hp}/${p.maxhp} ]`, 'ok');
        sidebar(ws, p);
      }
    }
    // Update regen bar every 30 seconds
    if (p.regenTimer % 30 === 0) raw(ws, {type:'regen', secs:p.regenTimer, max:REGEN_SECS});
  }
}, 1000);

// ── Sidebar ───────────────────────────────────────────────────────────────
function sidebar(ws, p) {
  const cls = CLASSES[p.classId]||{};
  const skills = (cls.skills||[]).map(sid => {const sk=SK[sid]||{}; return {name:sk.n||sid, cd:(p.cd||{})[sid]||0};});
  const myParty = getParty(p.username);
  let partyData = null;
  if (myParty) {
    const party = parties.get(myParty.id);
    if (party) partyData = [...party.members].map(u => {
      const m = [...sessions.values()].find(x => x.username===u&&x.loggedIn);
      return m ? {name:m.name, level:m.level, isLeader:party.leader===u, following:!!m.partyFollow} : null;
    }).filter(Boolean);
  }
  const g = p.guildId ? guilds[p.guildId] : null;
  raw(ws, {
    type:'sidebar', name:p.isAdmin?p.name+' ★':p.name,
    className:p.className, raceName:p.raceName||'', level:p.level,
    hp:p.hp, maxhp:p.maxhp, xp:p.xp, xpNext:p.level*500,
    gold:p.gold, atk:p.atk, def:p.def,
    room:world[p.room]?.name||p.room, zone:world[p.room]?.zone||'',
    equipped:p.equipped,
    inventory:(()=>{const c={};(p.inventory||[]).forEach(i=>{c[i]=(c[i]||0)+1;});return Object.entries(c).map(([n,x])=>x>1?`(${x}) ${n}`:n);})(),
    skills,
    inCombat:p.inCombat, shopNearby:!!(world[p.room]?.shop),
    shrineNearby:!!(world[p.room]?.teleport),
    companion:p.companion?{name:p.companion.name,hp:p.companion.hp,atk:p.companion.atk,maxhp:p.companion.maxhp}:null,
    zombieCount:(p.zombies||[]).length,
    party:partyData, partyFollow:!!p.partyFollow,
    quests:p.quests||{},
    guildName:g?g.name:null, guildMembers:g?g.members.length:0, guildBank:g?g.bank:0
  });
}

// ── Room description ──────────────────────────────────────────────────────
function describeRoom(ws, p) {
  const rm = world[p.room]; if (!rm) return;
  say(ws, '');
  say(ws, `— ${rm.zone} —`, 'zone');
  say(ws, `[ ${rm.name} ]`, 'room');
  say(ws, rm.desc, 'desc');
  const others = inRoom(p.room).filter(o => o.username !== p.username);
  if (others.length) say(ws, `  Players: ${others.map(o=>`${o.name} the ${o.raceName} ${o.className}`).join(', ')}`, 'players');
  // NPCs
  const npcsHere = Object.values(NPCS).filter(n => n.room === p.room);
  if (npcsHere.length) {
    npcsHere.forEach(n => {
      const idle = Math.random()<0.3&&n.idle?.length ? ' '+n.idle[rnd(0,n.idle.length-1)] : '';
      say(ws, `  💬 ${n.name} (${n.title}) is here.${idle}`, 'narrate');
    });
    say(ws, '  Type TALK [name] to speak with them.', 'sys');
  }
  (rm.monsters||[]).filter(m=>!m.dead).forEach(m => say(ws, `  ⚔  ${m.name} [HP:${m.hp}/${m.maxhp}]`, 'combat'));
  if (p.zombies&&p.zombies.length) say(ws, `  🧟 Zombies: ${p.zombies.map(z=>z.name).join(', ')}`, 'narrate');
  if (p.companion) say(ws, `  🐾 ${p.companion.name} [HP:${p.companion.hp}/${p.companion.maxhp} ATK:${p.companion.atk}]`, 'narrate');
  if (rm.items&&rm.items.length) say(ws, `  Items: ${rm.items.join(', ')}`, 'loot');
  if (rm.shop) say(ws, '  🛒 Shop here — SHOP to browse.', 'shop');
  if (rm.teleport) say(ws, '  ✦ Adventure Shrine — SHRINE to see destinations, TELEPORT [1-8] to travel.', 'skill');
  if (rm.guildDistrict) {
    const gl = Object.values(guilds);
    if (gl.length) say(ws, `  Active guilds: ${gl.map(g=>g.name).join(', ')}`, 'loot');
  }
  if (rm.guildHallRow) {
    const gl = Object.values(guilds);
    if (gl.length) say(ws, `  Guild halls: ${gl.map(g=>g.name).join(', ')} — GUILDHALL to enter yours.`, 'loot');
  }
  say(ws, `  Exits: ${Object.keys(rm.exits||{}).join(', ')}`, 'exits');
}

// ── Consumables ───────────────────────────────────────────────────────────
function useConsumable(ws, p, name) {
  const lc = name.toLowerCase();
  const heal = n => { const h=Math.min(n,p.maxhp-p.hp); p.hp+=h; say(ws,`+${n>=9999?p.maxhp:h} HP restored. [${p.hp}/${p.maxhp}]`,'ok'); return true; };
  if (lc==='healing potion') return heal(20);
  if (lc==='greater heal') return heal(50);
  if (lc==='full restore'||lc==='phoenix draught') return heal(9999);
  if (lc==='strength tonic') { p.atk+=3; say(ws,'ATK permanently +3!','ok'); return true; }
  if (lc==='iron skin draught') { p.def+=2; say(ws,'DEF permanently +2!','ok'); return true; }
  if (lc==='elixir of power') { p.atk+=8; say(ws,'ATK permanently +8!','ok'); return true; }
  if (lc==='elixir of stone') { p.def+=8; say(ws,'DEF permanently +8!','ok'); return true; }
  if (lc==='antidote') { say(ws,'Cleansed.','ok'); return true; }
  if (lc==='swamp herb') return heal(8);
  if (lc==='focus elixir') { heal(10); p.atkBonus=(p.atkBonus||0)+1; say(ws,'+10 HP, +1 ATK next hit.','ok'); return true; }
  return false;
}


// ── Taming ────────────────────────────────────────────────────────────────
function doTame(ws, p) {
  if (p.companion) return say(ws, `Already have ${p.companion.name}. DISMISS first.`, 'err');
  const rm = world[p.room];
  const tgt = (rm.monsters||[]).find(m => !m.dead && TAMEABLE[m.name]);
  if (!tgt) return say(ws, 'No tameable creatures here.', 'err');
  const ti = p.inventory.findIndex(i => i.toLowerCase()==='beast treat');
  if (ti===-1) return say(ws, 'Need a Beast Treat (buy at Apothecary, 15g).', 'err');
  const chance = 35 + (p.classId==='beastmaster'?35:0) + (p.raceId==='beastkin'?25:0);
  p.inventory.splice(ti, 1);
  if (rnd(1,100) <= chance) {
    const td = TAMEABLE[tgt.name];
    p.companion = {name:tgt.name, atk:td.atk, hp:td.hp, maxhp:td.hp};
    // Don't kill — remove from room monsters peacefully (animal follows willingly)
    const idx = (rm.monsters||[]).indexOf(tgt);
    if(idx>=0) rm.monsters.splice(idx,1);
    // End combat peacefully
    p.inCombat=false; p.enemy=null;
    say(ws, `You offer the treat slowly. The ${tgt.name} sniffs it... then nuzzles your hand.`, 'narrate');
    say(ws, `✓ ${tgt.name} is now your loyal companion!`, 'ok');
    sayRoom(p.room, `${p.name} tames a ${tgt.name}!`, 'narrate', ws);
    checkAch(ws, p, 'tamer');
  } else {
    say(ws, `The ${tgt.name} sniffs the treat but backs away. Beast Treat consumed.`, 'err');
    // On failure the animal is still alive — combat continues if in combat
  }
  sidebar(ws, p);
}

// ── Raise dead ────────────────────────────────────────────────────────────
function doRaiseDead(ws, p) {
  if (!p.zombies) p.zombies = [];
  if (p.zombies.length >= 3) return say(ws, 'Already control 3 zombies — maximum.', 'err');
  const rm = world[p.room];
  // Check corpse list first (preferred), fall back to dead monsters
  if(!rm.corpses) rm.corpses=[];
  const corpse = rm.corpses.find(c=>!c.raised) ||
                 (rm.monsters||[]).find(m=>m.dead);
  if (!corpse) return say(ws, 'No fallen corpses here. Kill something first, then use Raise Dead.', 'err');
  // Mark as raised so it can't be raised twice
  if(corpse.raised!==undefined) corpse.raised=true;
  const z = {name:`Zombie ${corpse.name}`, hp:Math.floor((corpse.maxhp||20)*0.75), maxhp:Math.floor((corpse.maxhp||20)*0.75), atk:Math.floor((corpse.atk||5)*0.7)};
  p.zombies.push(z);
  say(ws, `Dark energy surges through the fallen ${corpse.name}. It rises to serve you!`, 'skill');
  say(ws, `  Zombie ${corpse.name} [HP:${z.hp} ATK:${z.atk}] added to your undead army.`, 'skill');
  sayRoom(p.room, `${p.name} raises ${corpse.name} from the dead!`, 'narrate', ws);
  if (p.zombies.length >= 3) checkAch(ws, p, 'necro');
  sidebar(ws,p);
}

// ── Achievements ──────────────────────────────────────────────────────────
const ACHS = [
  {id:'first_blood',   name:'First Blood',    desc:'Win your first combat.',        reward:50},
  {id:'level5',        name:'Seasoned',        desc:'Reach Level 5.',                reward:100},
  {id:'level10',       name:'Veteran',         desc:'Reach Level 10.',               reward:250},
  {id:'level20',       name:'Legend',          desc:'Reach Level 20.',               reward:500},
  {id:'slayer10',      name:'Monster Slayer',  desc:'Kill 10 monsters.',             reward:75},
  {id:'slayer100',     name:'Monster Hunter',  desc:'Kill 100 monsters.',            reward:200},
  {id:'lich_slayer',   name:'Lich Slayer',     desc:'Defeat the Dungeon Lich.',      reward:300},
  {id:'all_bosses',    name:'Boss Hunter',     desc:'Slay all 4 main zone bosses.',  reward:600},
  {id:'crafter',       name:'Crafter',         desc:'Craft your first item.',        reward:50},
  {id:'tamer',         name:'Beast Tamer',     desc:'Tame a wild animal.',           reward:75},
  {id:'necro',         name:'Necromancer',     desc:'Command 3 zombies at once.',    reward:100},
  {id:'rich',          name:'Gold Hoarder',    desc:'Accumulate 1000 gold.',         reward:0},
  {id:'guild_founder', name:'Guild Founder',   desc:'Found a guild.',                reward:100},
  {id:'party_up',      name:'Better Together', desc:'Join or form a party.',         reward:50},
  {id:'explorer',      name:'Explorer',        desc:'Visit all 4 original zones.',   reward:200},
  {id:'deep_explorer', name:'Deep Explorer',   desc:'Visit all 8 adventure zones.',  reward:500}
];
function checkAch(ws, p, id) {
  if (!p.achievements) p.achievements = [];
  if (p.achievements.includes(id)) return;
  const def = ACHS.find(a => a.id===id); if (!def) return;
  p.achievements.push(id);
  if (def.reward > 0) p.gold += def.reward;
  say(ws, `🏆 ACHIEVEMENT: ${def.name} — ${def.desc}${def.reward>0?` (+${def.reward}g)`:''}`, 'loot');
  bAll({type:'line', text:`🏆 ${p.name} unlocked: ${def.name}!`, cls:'loot'});
}

// ── Level up ──────────────────────────────────────────────────────────────
function levelUp(ws, p) {
  while (p.xp >= p.level*500) {
    p.level++; p.maxhp+=12; p.hp=p.maxhp; p.atk+=2; p.def+=1;
    say(ws, `★ LEVEL UP! Level ${p.level}! HP restored. ATK +2, DEF +1. ★`, 'ok');
    if(p.level>=5)checkAch(ws,p,'level5');
    if(p.level>=10)checkAch(ws,p,'level10');
    if(p.level>=20)checkAch(ws,p,'level20');
    if(p.level%10===0)setTimeout(()=>offerSpecialization(ws,p),500);
  }
}

// ── Cooldown tick ─────────────────────────────────────────────────────────
function tickCD(p) {
  if (p.cd) for (const k in p.cd) if (p.cd[k]>0) p.cd[k]--;
  const dec = k => { if (p[k]>0) p[k]--; };
  ['bcT','pbT','frozenT','rageT','shiftT','lichT','consecT','regrowthT',
   'totemT','plagueT','curseT','darkpactT','doomT','darkAuraT','deathmarkT',
   'elementalT','catalystT','inspireT'].forEach(dec);
  if (p.shiftT===0&&p._shiftActive) { p.atk-=3;p.def-=3;p._shiftActive=false; }
  if (p.lichT===0&&p._lichActive)   { p.atk-=4;p.def-=2;p._lichActive=false; }
  if (p.darkpactT===0&&p._darkPactActive) { p.atk-=5;p._darkPactActive=false; }
  if (p.catalystT===0&&p._catalystActive){ p.atk-=3;p._catalystActive=false; }
  if (p.inspireT===0&&p._inspireActive)  { p.atk-=2;p._inspireActive=false; }
  if (p.elementalT===0&&p._elementalActive){ p.atk-=5;p._elementalActive=false; }
  if (p.rageT===0) p.rageA=0;
}

// ── Combat ────────────────────────────────────────────────────────────────
function getWeatherXPBonus(){ return (weather==='clear'&&!isNight)?1.1:1.0; }
function getWeatherCombatMod(roomId){
  // Storm makes outdoor monsters harder
  if(weather==='storm'&&OUTDOOR_ROOMS.includes(roomId))return 1.3;
  // Night makes all outdoor monsters stronger
  if(isNight&&OUTDOOR_ROOMS.includes(roomId))return 1.2;
  return 1.0;
}
function startCombat(ws, p, target) {
  const hostiles = (world[p.room].monsters||[]).filter(m=>!m.dead);
  if (!hostiles.length) return say(ws,'Nothing to attack here.','err');
  const m = (target&&hostiles.find(x=>x.name.toLowerCase().includes(target)))||hostiles[0];
  p.inCombat=true; p.enemy=m;
  const combatMod=getWeatherCombatMod(p.room);
  if(combatMod>1.0){
    const modLabel=weather==='storm'?'Storm-empowered':'Night-shrouded';
    say(ws,`  ⚡ ${modLabel} — this creature fights harder in these conditions!`,'err');
  }
  say(ws, `You engage ${m.name}! [HP:${m.hp}/${m.maxhp}]`, 'combat');
  say(ws, 'ATTACK / FLEE / SKILL [name] / USE [item]', 'sys');
  sayRoom(p.room, `${p.name} engages ${m.name}!`, 'combat', ws);
  // Send monster portrait if available
  const portrait=MOB_PORTRAITS[m.name];
  if(portrait)raw(ws,{type:'mob_portrait',name:m.name,img:'/monsters/'+portrait,hp:m.hp,maxhp:m.maxhp,atk:m.atk,def:m.def});
}

function playerAttack(ws, p) {
  const m = p.enemy;
  const pb = (p.pbT||0)>0?p.pbD:0, rage=(p.rageT||0)>0?p.rageA:0;
  const dm = (p.deathmarkT||0)>0?1.5:1, doom=(p.doomT||0)>0?2:1;
  const raw2 = Math.floor((p.atk+(p.atkBonus||0)+pb+rage)*dm*doom);
  p.atkBonus=0;
  const d = Math.max(1, raw2-m.def+rnd(-1,2));
  m.hp -= d;
  say(ws, `You strike ${m.name} for ${d} damage!${pb>0?` (+${pb} poison)`:''} [${Math.max(0,m.hp)}/${m.maxhp} HP]`, 'combat');
  // Update monster HP on portrait
  const _port=MOB_PORTRAITS[m.name];if(_port)raw(ws,{type:'mob_hp',hp:Math.max(0,m.hp),maxhp:m.maxhp});
  sayRoom(p.room, `${p.name} hits ${m.name} for ${d}!`, 'combat', ws);
  if (p.companion&&p.companion.hp>0) { const cd=rnd(Math.floor(p.companion.atk*0.6),p.companion.atk); m.hp-=cd; say(ws,`${p.companion.name} attacks for ${cd}!`,'narrate'); }
  if (p.zombies&&p.zombies.length) { let zt=0; p.zombies.forEach(z=>{const zd=rnd(Math.floor(z.atk*0.5),z.atk);m.hp-=zd;zt+=zd;}); say(ws,`Your ${p.zombies.length} zombie(s) deal ${zt} damage!`,'narrate'); }
  if (m.hp<=0) return killMonster(ws,p,m);
  monsterAttack(ws,p,m);
}

function killMonster(ws, p, m) {
  m.dead=true;
  say(ws, `You slay ${m.name}!`, 'ok');
  sayRoom(p.room, `${p.name} slays ${m.name}!`, 'ok', ws);
  const bonus=(p.classId==='rogue'?rnd(1,12):0)+(p.raceId==='goblin'?rnd(1,8):0);
  const xpBonus=Math.floor(m.xp*getWeatherXPBonus());p.xp+=xpBonus; p.gold+=m.gold+bonus; p.killCount=(p.killCount||0)+1;
  say(ws, `+${m.xp} XP, +${m.gold+bonus} gold. [${p.killCount} kills]`, 'loot');
  // Leave a corpse that can be raised
  if(!world[p.room].corpses) world[p.room].corpses=[];
  world[p.room].corpses.push({name:m.name,maxhp:m.maxhp,atk:m.atk,raised:false});
  // Corpses decay after 10 minutes
  setTimeout(()=>{
    if(world[p.room]&&world[p.room].corpses)
      world[p.room].corpses=world[p.room].corpses.filter(c=>c.name!==m.name||c.raised);
  },600000);
  if (m.loot) {
    if(p.autoloot){
      p.inventory.push(m.loot);
      say(ws,`[Auto-loot] ${m.loot} picked up.`,'loot');
      const eq=EQ[m.loot.toLowerCase()];
      if(eq)say(ws,`  [${eq.t.toUpperCase()}] ATK+${eq.atk} DEF+${eq.def} — EQUIP to use.`,'sys');
    }else{
      world[p.room].items.push(m.loot);
      say(ws,`Dropped: ${m.loot}`,'loot');
      const eqDrop=EQ[m.loot.toLowerCase()];
      if(eqDrop)say(ws,`  [${eqDrop.t.toUpperCase()}] ATK+${eqDrop.atk} DEF+${eqDrop.def} — TAKE it then EQUIP ${m.loot}`,'loot');
    }
  }
  // Party XP share
  const party = getParty(p.username);
  if (party && party.members.size>1) {
    const shareXP = Math.floor(m.xp*0.7);
    party.members.forEach(u => {
      if (u===p.username) return;
      const mate = [...sessions.values()].find(x=>x.username===u&&x.loggedIn);
      if (mate) { mate.xp+=shareXP; say(mate.ws,`Party XP: +${shareXP} from ${p.name}'s kill.`,'ok'); levelUp(mate.ws,mate); }
    });
  }
  p.inCombat=false; p.enemy=null; p.backstabUsed=false;
  tickCD(p); levelUp(ws,p);
  checkAch(ws,p,'first_blood');
  if(p.killCount>=10)checkAch(ws,p,'slayer10');
  if(p.killCount>=100)checkAch(ws,p,'slayer100');
  if(p.gold>=1000)checkAch(ws,p,'rich');
  const BOSSES=['Dungeon Lich','Flame Titan','Frost Queen','Storm God','Void Emperor','Prism Titan','Death Baron','Astral Leviathan','Void God'];
  if (BOSSES.includes(m.name)) {
    bAll({type:'line',text:`*** ${p.name} the ${p.raceName} ${p.className} has slain ${m.name}! ***`,cls:'loot'});
    if (m.name==='Dungeon Lich') { checkAch(ws,p,'lich_slayer'); doVictory(ws,p); }
  }
  svc(p); sidebar(ws,p);
}

function monsterAttack(ws, p, m) {
  if ((p.frozenT||0)>0) { say(ws,`${m.name} is frozen!`,'skill'); tickCD(p); sidebar(ws,p); return; }
  let mdmg = Math.max(1, m.atk-p.def+rnd(-1,1));
  if ((p.bcT||0)>0) mdmg=Math.max(1,mdmg-(p.bcV||0));
  if ((p.plagueT||0)>0) { m.hp-=(p.plagueD||0); say(ws,`Plague: ${p.plagueD} to ${m.name}.`,'skill'); if(m.hp<=0){tickCD(p);return killMonster(ws,p,m);} }
  if ((p.curseT||0)>0)  { m.hp-=(p.curseD||0);  say(ws,`Curse: ${p.curseD} to ${m.name}.`,'skill');  if(m.hp<=0){tickCD(p);return killMonster(ws,p,m);} }
  if ((p.consecT||0)>0) { m.hp-=4;              say(ws,'Consecrate: 4 to enemy.','skill'); if(m.hp<=0){tickCD(p);return killMonster(ws,p,m);} }
  if ((p.regrowthT||0)>0) { const h=Math.min(5,p.maxhp-p.hp);p.hp+=h; say(ws,`Regrowth: +${h} HP.`,'skill'); }
  if ((p.totemT||0)>0)    { const h=Math.min(p.totemH||5,p.maxhp-p.hp);p.hp+=h; say(ws,`Totem: +${h} HP.`,'skill'); }
  // Shields
  const tryShield = (key, label) => {
    if (!p.sh) return;
    if (p.sh[key]===true) { say(ws,`${label} blocks completely!`,'skill'); p.sh[key]=false; mdmg=0; }
    else if (typeof p.sh[key]==='number'&&p.sh[key]>0) { const a=Math.min(p.sh[key],mdmg); p.sh[key]-=a; mdmg-=a; if(a>0)say(ws,`${label} absorbs ${a} [${p.sh[key]} left].`,'skill'); }
  };
  tryShield('divine','Divine Shield'); tryShield('arcane','Arcane Shield'); tryShield('wall','Shield Wall');
  tryShield('bone','Bone Shield'); tryShield('bark','Barkskin'); tryShield('fortress','Fortress');
  tryShield('mana','Mana Shield'); tryShield('ancestral','Ancestral Shield'); tryShield('death','Death Shield'); tryShield('wild','Wild Instinct');
  const tryDodge = (key, label) => { if (p.sh&&(p.sh[key]||0)>0) { p.sh[key]--; mdmg=0; say(ws,`${label}: dodged!`,'skill'); } };
  tryDodge('shadow','Shadowstep'); tryDodge('blink','Blink'); tryDodge('deflect','Deflect');
  tryDodge('mirror','Mirror Image'); tryDodge('counter','Counter'); tryDodge('fade','Fade');
  if (mdmg>0) { p.hp-=mdmg; say(ws,`${m.name} retaliates for ${mdmg}. [HP:${p.hp}/${p.maxhp}]`,'combat'); }
  tickCD(p); sidebar(ws,p);
  if (p.hp<=0) playerDied(ws,p);
}

function playerDied(ws, p) {
  p.inCombat=false; p.enemy=null; p.dead=false; p.hp=1; p.zombies=[];
  say(ws,''); say(ws,'╔══════════════════════════╗','err');
  say(ws,'║    Y O U   D I E D      ║','err');
  say(ws,'╚══════════════════════════╝','err');
  say(ws,'Your zombies crumble. You awaken in the Town Square.','narrate');
  p.room='town_square'; describeRoom(ws,p); svc(p); sidebar(ws,p);
}

function doVictory(ws, p) {
  say(ws,'╔══════════════════════════════╗','loot');
  say(ws,'║     V I C T O R Y !        ║','loot');
  say(ws,'║  The Dungeon Lich crumbles! ║','loot');
  say(ws,'╚══════════════════════════════╝','loot');
}


// ── NPC definitions ───────────────────────────────────────────────────────
const NPCS = {
  tormund: {name:'Tormund',title:'Barkeep of the Broken Flagon',room:'tavern',ai:true,
    portrait:'tormund',portraitFile:'tormund.jpg',
    desc:'A barrel-chested man with a grey-streaked beard and the permanently tired eyes of someone who has heard too many hard-luck stories. He has run the Broken Flagon for twenty years and knows every face that has passed through Shadowmere — including those that never came back.',
    personality:"You are Tormund, gruff but warm barkeep at The Broken Flagon in Shadowmere. Keep responses 2-3 sentences, stay in character. You know the dungeon is south then down, the shrine is in the town square, Grimwald makes weapons, Mira sells potions, the Shadow Broker is in the alley cellar.",
    greeting:"Tormund wipes down the bar. 'What'll it be?'",
    idle:["Tormund mutters: 'Haven't seen this many dead walk since the last purge...'","Tormund glances at the door. 'Every hero who went into that dungeon... most don't come back the same.'"]},
  grimwald:{name:'Grimwald',title:'Master Weaponsmith',room:'weaponsmith',ai:true,
    portrait:'grimwald',portraitFile:'grimwald.jpg',
    desc:'A mountain of a man, arms like forge bellows and hands scarred from a lifetime at the anvil. Grimwald speaks rarely and means every word. The weapons on his walls have ended more monsters than any adventurer can count.',
    personality:"You are Grimwald, taciturn master weaponsmith. Speak in short blunt sentences. You care deeply about quality steel. 1-2 sentences maximum.",
    greeting:"Grimwald doesn't look up. 'Shop or talk. Not both.'",
    idle:["Grimwald holds a blade to the light and plunges it back into the forge.","Grimwald growls: 'Dull blade gets you killed.'"]},
  mira:    {name:'Mira',title:'Apothecary',room:'apothecary',ai:true,
    portrait:'mira',portraitFile:'mira.jpg',
    desc:'A silver-haired woman of indeterminate age with quick, precise hands and an unsettling habit of diagnosing ailments before you have mentioned them. She has studied at three colleges of medicine and chosen this ruined town because, as she says, it keeps her busiest.',
    personality:"You are Mira, calm knowledgeable apothecary. Speak thoughtfully and precisely. 2-3 sentences. You know about herbs, potions, and monster drops.",
    greeting:"Mira looks up from her mortar. 'What ails you, traveller?'",
    idle:["Mira carefully measures a powder, lips moving silently.","Mira says softly: 'The dungeon air carries a miasma. Come to me if you feel weakened.'"]},
  aldric:  {name:'Father Aldric',title:'Last Priest of the Temple',room:'temple',ai:true,
    portrait:'aldric',portraitFile:'aldric.jpg',
    desc:'The last surviving priest of the Temple of the Fallen. Once the head of a thriving order; now an old man alone in a ruin, keeping candles lit as an act of stubbornness against the dark. His faith has been shaken but never broken.',
    personality:"You are Father Aldric, last priest of the Temple of the Fallen. Old, tired, sorrowful. Formal archaic speech. 2-3 sentences.",
    greeting:"Father Aldric turns from the altar, eyes red from weeping. 'Bless you for coming, child.'",
    idle:["Father Aldric whispers a prayer, hands clasped tight.","Aldric murmurs: 'The lich was once a great wizard who sought immortality. He found it — at terrible cost.'"]},
  broker:  {name:'The Shadow Broker',title:'Dealer in Rare Goods',room:'black_market',ai:true,
    portrait:'broker',portraitFile:'broker.jpg',
    desc:'No one knows the Shadow Broker real name, race, or history. They have been in that cellar, it is said, longer than the town has stood. They deal in objects that have no business existing and information that has no business being known.',
    personality:"You are the Shadow Broker, mysterious and cryptic. Speak in half-sentences, implying more than you say. 1-2 sentences, occasionally unsettling.",
    greeting:"The hooded figure doesn't move. A rasping voice: 'I wondered when you'd find me.'",
    idle:["The Shadow Broker seems to watch you, though you can't see their eyes.","A whisper: 'I know what you seek. The question is the price.'"]},
  pip:     {name:'Pip',title:'Exotic Animal Merchant',room:'pet_store',ai:true,
    portrait:'pip',portraitFile:'pip.jpg',
    desc:'A halfling of boundless energy and zero self-preservation instinct who has been bitten, stung, clawed, and sat on by every creature in the Menagerie. Pip considers this a sign of mutual affection. Every animal here has a name, a birthday, and a complete backstory.',
    personality:"You are Pip, enthusiastic halfling who runs the Exotic Menagerie. You LOVE animals with infectious enthusiasm. Very cheerful, uses exclamation points. 2-3 sentences.",
    greeting:"Pip bounces up. 'Oh! A visitor! Don't mind Chester — he bites but only out of love!'",
    idle:["Pip coos at a shadow fox: 'Yes you are the most magnificent thing...'","Pip calls out: 'The Iron Tortoise is very underrated!'"]},
  marta:   {name:'Marta',title:'General Store Owner',room:'ashford_store',ai:true,
    personality:"You are Marta, tough practical storekeeper in Ashford Village. Survivors settled this village after the old war. You are wary of strangers but fair. Short direct sentences. You know about the bandit problem east of town.",
    greeting:"Marta looks you up and down. 'Coin or no coin, that's the question.'",
    idle:["Marta wipes down the counter. 'Bandits east of town getting bolder every week.'","Marta grunts: 'We don't get many outsiders here. Usually they're running from something.'"]},
  barret:  {name:'Old Barret',title:'Innkeeper',room:'ashford_inn',ai:true,
    personality:"You are Old Barret, weathered innkeeper of the Rusted Nail in Ashford Village. You have seen everything in your long years. Warm but tired. You know local gossip and the history of the village.",
    greeting:"Barret looks up slowly. 'Long road to find Ashford. Most go around. What brings you here?'",
    idle:["Barret polishes a glass and stares at nothing.","Barret murmurs: 'Village used to be three times this size. Before the war.'"]},
  finn:    {name:'Brother Finn',title:'Healer',room:'ashford_healer',ai:true,
    portrait:'finn',portraitFile:'finn.jpg',
    desc:'A gentle travelling monk who stayed in Ashford to tend the sick. Young face but calm beyond his years. Simple robes, healing herbs hanging from his belt.',
    personality:"You are Brother Finn, a gentle travelling monk who stayed in Ashford to tend the sick. Calm, compassionate, slightly otherworldly. You know about healing, herbs, and the spiritual nature of the Dungeon Lich's curse.",
    greeting:"Finn looks up with kind eyes. 'Ah, a traveller. Are you hurt? Sit, sit.'",
    idle:["Finn hums softly while grinding herbs.","Finn says quietly: 'The darkness in the dungeon seeps into the very soil here. I can feel it.'"]},
  voss:    {name:'Registrar Voss',title:'Guild Registry Clerk',room:'guild_registry',ai:true,
    portrait:'voss',portraitFile:'voss.jpg',
    desc:'An officious man of precise habits and ink-stained fingers surrounded by towering ledgers. Registrar Voss has processed every guild application in Shadowmere for twenty years. He finds disorder personally offensive.',
    personality:"You are Registrar Voss, officious bureaucratic clerk at the Guild Registry. Precise, formal, slightly condescending. You care deeply about proper procedure and documentation. 1-2 sentences.",
    greeting:"Voss looks up over his spectacles. 'Name. Purpose. And please do not touch the ledgers.'",
    idle:["Voss mutters while cross-referencing two enormous ledgers.","Voss sighs. 'Another guild with an unapproved sigil. Third this month.'"]},
  keeper:  {name:'The Keeper',title:'Guardian of the Adventure Shrine',room:'adventure_shrine',ai:true,
    portrait:'keeper',portraitFile:'keeper.jpg',
    desc:'An ancient figure of indeterminate age, gender, and possibly species. The Keeper has tended the shrine since before living memory. They speak of heroes who passed through centuries ago as though the encounters were yesterday. They are always calm. This is more unsettling than anger would be.',
    personality:"You are the Keeper, ancient guardian of the Adventure Shrine. Calm, measured, with ancient sadness. Know details about every adventure zone and their bosses. Poetic, 2-3 sentences.",
    greeting:"The Keeper turns slowly. Ancient eyes regard you. 'Another soul seeking glory in distant lands.'",
    idle:["The Keeper traces a glowing rune on the standing stone.","The Keeper says: 'The stones remember every hero who stepped through. Most are names now. Only names.'"]}
};

// ── Quests ────────────────────────────────────────────────────────────────
const QUESTS = {
  tavern_rats:{id:'tavern_rats',giver:'tormund',title:"Tormund's Rat Problem",
    obj:"Kill 5 Giant Rats in the Dark Alley.",reward:{gold:40,xp:80,item:'Greater Heal'},
    start:"Tormund leans in. 'Rats have been getting into my ale barrels. The alley is crawling with them. Kill five, bring me proof — by proof I mean tails — and drinks are on me.'",
    progress:"Tormund: 'How many rats you got? Keep at it.'",
    complete:"Tormund counts the tails, grimaces, slides a coin purse across. 'Good work. Here — and have a Greater Heal on me.'",
    check:p=>( p.killCount>=5 )},
  missing_merchant:{id:'missing_merchant',giver:'tormund',title:'The Missing Merchant',
    obj:"Find Aldwyn's satchel in the Dungeon Hall and return it.",reward:{gold:120,xp:200,item:"Knight's Sword"},
    start:"Tormund's voice drops. 'My friend Aldwyn went into that dungeon three days back. Never came out. His satchel — brown leather, brass clasp — if you find it, bring it back. Please.'",
    progress:"Tormund: 'Any sign of Aldwyn's satchel down there?'",
    complete:"Tormund takes the satchel with both hands and holds it quietly. 'Thank you. He was a good man.' He sets a fine sword on the bar.",
    check:p=>p.inventory.some(i=>i==="Aldwyn's satchel")},
  mira_herbs:{id:'mira_herbs',giver:'mira',title:"Mira's Herb Supply",
    obj:"Bring Mira 3 swamp herbs from the forest.",reward:{gold:30,xp:60,item:'Full Restore'},
    start:"Mira sighs. 'My swamp herb supply is exhausted. If you're heading to the forest, three fresh herbs would be well rewarded. They grow near the swamp border.'",
    progress:"Mira: 'Any luck finding swamp herbs? Near the border area.'",
    complete:"Mira takes the herbs with a relieved smile. 'Perfect. Fresh too.' She hands over a sealed vial. 'Full restoration draught. My personal recipe.'",
    check:p=>{const inv=[...p.inventory];let c=0;for(let i=0;i<3;i++){const idx=inv.findIndex(x=>x.toLowerCase()==='swamp herb');if(idx>=0){inv.splice(idx,1);c++;}}return c>=3;}},
  temple_blessing:{id:'temple_blessing',giver:'aldric',title:'The Temple Blessing',
    obj:"Receive Father Aldric's blessing.",reward:{gold:0,xp:50,stat:{atk:1,def:1}},
    start:"Aldric places a hand on your shoulder. 'Let me offer you what little I can — a blessing. It will sharpen your mind and steady your hand.'",
    progress:'',
    complete:"Aldric murmurs a prayer and traces a symbol on your forehead. 'Go with courage.' You feel warmth in your bones — ATK +1, DEF +1, permanently.",
    check:p=>true},
  aldric_relic:{id:'aldric_relic',giver:'aldric',title:'The Fallen Relic',
    obj:"Find the ancient rune in the Temple Crypt and return it.",reward:{gold:80,xp:150,item:'Iron Shield'},
    start:"Aldric grips the altar. 'A holy relic was stolen by risen cultists. They carried it to the crypt below. Please — it must be returned.'",
    progress:"Aldric: 'The relic — a glowing rune. The crypt is south through the temple.'",
    complete:"Aldric takes the rune with trembling hands and weeps. 'You have my eternal gratitude.' He hands you a blessed shield.",
    check:p=>p.inventory.some(i=>i.toLowerCase()==='ancient rune')},
  pip_runaway:{id:'pip_runaway',giver:'pip',title:"Pip's Runaway Raven",
    obj:"Find a storm feather in the Sky Ruins and return to Pip.",reward:{gold:35,xp:70,pet:{name:'Raven',atk:4,hp:18,maxhp:18}},
    start:"Pip wrings their hands. 'Magnus got out! My prize raven! He always flies somewhere high when he's scared. Please find a big feather with a blue tip — that's Magnus!'",
    progress:"Pip: 'Any sign of Magnus? Big raven, very dramatic about everything.'",
    complete:"Pip SQUEALS with delight. 'Magnus!!' Pip produces a raven from a cage. 'This is Corvus — identical to Magnus but better personality. He's yours!'",
    check:p=>p.inventory.some(i=>i.toLowerCase()==='storm feather')}
};

function hasQ(p,qid){return !!(p.quests||{})[qid];}
function doneQ(p,qid){return (p.quests||{})[qid]==='done';}

function finishQuest(ws,p,qid){
  if(!p.quests)p.quests={};
  p.quests[qid]='done';
  const q=QUESTS[qid];if(!q)return;
  say(ws,`[ Quest Complete: ${q.title} ]`,'loot');
  say(ws,q.complete,'narrate');
  if(q.reward.gold){p.gold+=q.reward.gold;say(ws,`  +${q.reward.gold} gold!`,'loot');}
  if(q.reward.xp){p.xp+=q.reward.xp;say(ws,`  +${q.reward.xp} XP!`,'loot');levelUp(ws,p);}
  if(q.reward.item){
    p.inventory.push(q.reward.item);
    say(ws,`  Received: ${q.reward.item}!`,'loot');
    const eqItem=EQ[q.reward.item.toLowerCase()];
    if(eqItem)say(ws,`  Type EQUIP ${q.reward.item} to use it.`,'sys');
    // Consume fetch/gather items
    if(q.check.toString().includes('satchel')||q.check.toString().includes('rune')||q.check.toString().includes('feather')){
      const targets=["Aldwyn's satchel",'ancient rune','storm feather'];
      targets.forEach(t=>{const i=p.inventory.indexOf(t);if(i>=0)p.inventory.splice(i,1);});
    }
  }
  if(q.reward.stat){
    if(q.reward.stat.atk){p.atk+=q.reward.stat.atk;say(ws,`  ATK +${q.reward.stat.atk} permanently!`,'loot');}
    if(q.reward.stat.def){p.def+=q.reward.stat.def;say(ws,`  DEF +${q.reward.stat.def} permanently!`,'loot');}
  }
  if(q.reward.pet&&!p.companion){
    p.companion={...q.reward.pet};
    say(ws,`  ${q.reward.pet.name} joins as your companion!`,'ok');
  }
  svc(p);sidebar(ws,p);
}

async function doTalk(ws,p,target){
  const npcsHere=Object.values(NPCS).filter(n=>n.room===p.room);
  let npc=null;
  if(target) npc=npcsHere.find(n=>n.name.toLowerCase().includes(target.toLowerCase()));
  else npc=npcsHere[0];
  if(!npc){
    const any=Object.values(NPCS).find(n=>n.name.toLowerCase().includes((target||'').toLowerCase()));
    if(any)return say(ws,`${any.name} isn't here.`,'err');
    return say(ws,'No one to talk to here.','err');
  }
  say(ws,'');
  say(ws,`── ${npc.name} (${npc.title}) ────────────────────`,'loot');
  say(ws,npc.greeting,'narrate');
  // Aldwyn broker special
  if(npc.name==='Father Aldric'&&p.inventory.includes('sealed package')&&(p.quests||{}).broker_delivery==='active'){
    say(ws,"Aldric notices the parcel. 'What's this?' He takes it carefully.",'narrate');
    if(!p.quests)p.quests={};p.quests.broker_delivery='done';
    p.inventory.splice(p.inventory.indexOf('sealed package'),1);
    p.gold+=200;say(ws,'Quest done: +200g (the broker will pay you)','loot');svc(p);
  }
  // Quest handling
  let shownQ=false;
  const npcQuests=Object.values(QUESTS).filter(q=>q.giver===Object.keys(NPCS).find(k=>NPCS[k]===npc));
  // Check chain quest completions first
  for(const q of Object.values(QUEST_CHAINS)){
    if((p.quests||{})[q.id]==='active'&&q.check(p)){
      const giverNpcKey=Object.keys(NPCS).find(k=>NPCS[k]===npc);
      if(q.giver===giverNpcKey){
        say(ws,`[ Quest Complete: ${q.title} ]`,'loot');
        say(ws,q.complete,'narrate');
        if(q.reward.gold){p.gold+=q.reward.gold;say(ws,`  +${q.reward.gold} gold!`,'loot');}
        if(q.reward.xp){p.xp+=q.reward.xp;say(ws,`  +${q.reward.xp} XP!`,'loot');levelUp(ws,p);}
        if(q.reward.item){p.inventory.push(q.reward.item);say(ws,`  Received: ${q.reward.item}!`,'loot');}
        p.quests[q.id]='done';svc(p);sidebar(ws,p);shownQ=true;break;
      }
    }
  }
  for(const q of npcQuests){
    if(hasQ(p,q.id)&&!doneQ(p,q.id)){
      if(q.check(p)){finishQuest(ws,p,q.id);shownQ=true;break;}
      else{say(ws,`[ Quest: ${q.title} — In Progress ]`,'sys');say(ws,q.progress,'narrate');say(ws,`  Objective: ${q.obj}`,'sys');shownQ=true;break;}
    }
    if(!hasQ(p,q.id)&&!doneQ(p,q.id)){
      say(ws,`[ New Quest: ${q.title} ]`,'loot');say(ws,q.start,'narrate');
      say(ws,`  Objective: ${q.obj}`,'sys');
      const rw=[q.reward.gold?q.reward.gold+'g':'',q.reward.xp?q.reward.xp+' XP':'',q.reward.item||'',q.reward.pet?q.reward.pet.name+' (companion)':''].filter(Boolean).join(', ');
      say(ws,`  Reward: ${rw}`,'loot');
      say(ws,'  Type ACCEPT to take this quest, or ASK [question] to talk.','sys');
      p._pendingQ=q.id;shownQ=true;break;
    }
  }
  // Check chain quests
  if(!shownQ){
    const chainQ=Object.values(QUEST_CHAINS).find(q=>{
      const giverNpc=Object.keys(NPCS).find(k=>NPCS[k]===npc);
      return q.giver===giverNpc && !hasQ(p,q.id) && !doneQ(p,q.id) && doneQ(p,q.unlocks_after);
    });
    if(chainQ){
      say(ws,`[ New Quest: ${chainQ.title} ]`,'loot');say(ws,chainQ.start,'narrate');
      say(ws,`  Objective: ${chainQ.obj}`,'sys');
      const rw=[chainQ.reward.gold?chainQ.reward.gold+'g':'',chainQ.reward.xp?chainQ.reward.xp+' XP':'',chainQ.reward.item||''].filter(Boolean).join(', ');
      say(ws,`  Reward: ${rw}`,'loot');
      say(ws,'  Type ACCEPT to take this quest.','sys');
      p._pendingQ=chainQ.id;shownQ=true;
    }
  }
  if(!shownQ){say(ws,'  Type ASK [question] to talk freely.','sys');}
  if(p.hp<p.maxhp*0.3)say(ws,`${npc.name} eyes you with concern. "You look badly hurt."`, 'narrate');
  if((p.achievements||[]).includes('lich_slayer')&&npc.room==='temple')say(ws,'Father Aldric bows deeply. "The lich slayer. This town owes you everything."','narrate');
}

async function doAsk(ws,p,question){
  const npcsHere=Object.values(NPCS).filter(n=>n.room===p.room&&n.ai);
  const npc=npcsHere[0];
  if(!npc)return say(ws,'No one to ask here.','err');
  const apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey||typeof fetch==='undefined'){
    const fb=npc.idle?.[rnd(0,(npc.idle.length||1)-1)];
    say(ws,fb||`${npc.name} looks thoughtful but says nothing.`,'narrate');
    return;
  }
  say(ws,`You ask: "${question}"`,'prompt');
  const ctx=`Player: ${p.name} the ${p.raceName} ${p.className}, Level ${p.level}, HP ${p.hp}/${p.maxhp}, in ${world[p.room]?.name||p.room}.`;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:150,system:npc.personality+'\n\nContext: '+ctx,messages:[{role:'user',content:question}]})
    });
    const data=await res.json();
    const reply=data?.content?.[0]?.text||`${npc.name} regards you silently.`;
    say(ws,`${npc.name}: "${reply}"`,'narrate');
  }catch(e){
    const fb=npc.idle?.[rnd(0,(npc.idle.length||1)-1)];
    say(ws,fb||`${npc.name} looks thoughtful but says nothing.`,'narrate');
  }
}


// ── Shrine / teleport ─────────────────────────────────────────────────────
function showShrine(ws,p){
  say(ws,'');say(ws,'✦ ══════ THE ADVENTURE SHRINE ══════ ✦','skill');
  say(ws,'The Keeper: "Choose your destination, brave soul."','narrate');
  for(const[k,z]of Object.entries(TELEPORT_ZONES)){
    const locked=p.level<z.lvl;
    if(locked) say(ws,`  [${k}] ${z.name.padEnd(22)} Lv${z.lvl}+  [LOCKED]`,'err');
    else say(ws,`  [${k}] ${z.name.padEnd(22)} Lv${z.lvl}+  Boss: ${z.boss}  — ${z.threat}`,'ok');
  }
  say(ws,`  Your Level: ${p.level}  |  TELEPORT [1-8] to travel  |  TELEPORT HOME to return`,'sys');
  const vc=(p.zonesVisited||[]).length;if(vc>0)say(ws,`  Zones visited: ${vc}/8`,'sys');
}

function doTeleport(ws,p,arg){
  if(p.inCombat)return say(ws,'Cannot teleport in combat!','err');
  if(arg==='home'||arg==='town'){p.room='town_square';say(ws,'Reality bends. You appear in the Town Square.','narrate');describeRoom(ws,p);sidebar(ws,p);return;}
  if(!world[p.room]?.teleport)return say(ws,'You must be at the Adventure Shrine (UP from Town Square).','err');
  const z=TELEPORT_ZONES[arg];if(!z)return say(ws,'Unknown zone. Type SHRINE to see options.','err');
  if(p.level<z.lvl)return say(ws,`Need Level ${z.lvl} for ${z.name}. You are Level ${p.level}.`,'err');
  p.room=z.dest;
  if(!p.zonesVisited)p.zonesVisited=[];
  if(!p.zonesVisited.includes(z.dest))p.zonesVisited.push(z.dest);
  say(ws,'The standing stones blaze with light. Reality tears. You step through...','narrate');
  say(ws,`You arrive at ${z.name}!`,'ok');
  bAll({type:'line',text:`${p.name} teleports to ${z.name}!`,cls:'narrate'});
  const orig4=['volcanic_peak','frozen_tundra','sky_realm','shadow_realm'];
  const all8=[...orig4,'crystal_caverns','haunted_keep','astral_sea','void_sanctum'];
  if(orig4.every(d=>p.zonesVisited.includes(d)))checkAch(ws,p,'explorer');
  if(all8.every(d=>p.zonesVisited.includes(d)))checkAch(ws,p,'deep_explorer');
  describeRoom(ws,p);sidebar(ws,p);
}

// ── Guild commands ────────────────────────────────────────────────────────
function guildCmd(ws,p,sub,rest){
  switch(sub){
    case'create':{
      if(p.guildId)return say(ws,`Already in guild: ${guilds[p.guildId]?.name}. Leave first.`,'err');
      if(!rest)return say(ws,'GUILD CREATE [name]','err');
      const gname=rest.slice(0,30).replace(/[^a-zA-Z0-9 ]/g,'').trim();
      if(gname.length<3)return say(ws,'Name must be at least 3 characters.','err');
      if(Object.values(guilds).find(g=>g.name.toLowerCase()===gname.toLowerCase()))return say(ws,'That name is taken.','err');
      const gid='g'+Date.now();
      guilds[gid]={name:gname,leader:p.username,members:[p.username],bank:0,motd:''};
      p.guildId=gid;saveGuilds();svc(p);
      say(ws,`Guild "${gname}" founded! You are the Guild Leader.`,'ok');
      checkAch(ws,p,'guild_founder');break;
    }
    case'join':{
      if(p.guildId)return say(ws,'Already in a guild. Leave first (GUILD LEAVE).','err');
      if(!rest)return say(ws,'GUILD JOIN [name]','err');
      const entry=Object.entries(guilds).find(([,g])=>g.name.toLowerCase()===rest.toLowerCase());
      if(!entry)return say(ws,`Guild "${rest}" not found.`,'err');
      const[gid,g]=entry;g.members.push(p.username);p.guildId=gid;saveGuilds();svc(p);
      say(ws,`You join "${g.name}"!`,'ok');
      [...sessions.values()].filter(x=>x.loggedIn&&x.guildId===gid&&x.username!==p.username)
        .forEach(x=>say(x.ws,`${p.name} joined ${g.name}!`,'ok'));
      break;
    }
    case'leave':{
      if(!p.guildId)return say(ws,'Not in a guild.','err');
      const g=guilds[p.guildId];if(!g)return;
      g.members=g.members.filter(u=>u!==p.username);
      if(g.members.length===0)delete guilds[p.guildId];
      else if(g.leader===p.username)g.leader=g.members[0];
      p.guildId='';saveGuilds();svc(p);say(ws,`You leave the guild.`,'ok');break;
    }
    case'info':case'':case undefined:{
      if(!p.guildId&&!rest)return say(ws,'Not in a guild. GUILD LIST to see all guilds.','sys');
      const entry=rest?Object.entries(guilds).find(([,g])=>g.name.toLowerCase()===rest.toLowerCase()):[p.guildId,guilds[p.guildId]];
      if(!entry||!entry[1])return say(ws,'Guild not found.','err');
      const[,g]=entry;
      say(ws,`─── ${g.name} ─────────────────────────`,'loot');
      say(ws,`  Leader: ${g.leader}  Members: ${g.members.length}  Bank: ${g.bank}g`,'sys');
      if(g.motd)say(ws,`  MOTD: ${g.motd}`,'narrate');
      say(ws,`  Members: ${g.members.join(', ')}`,'sys');break;
    }
    case'list':{
      const all=Object.values(guilds);
      if(!all.length)return say(ws,'No guilds yet. GUILD CREATE [name] to found one.','sys');
      say(ws,'─── Active Guilds ─────────────────────────','sys');
      all.forEach(g=>say(ws,`  ${g.name.padEnd(20)} ${g.members.length} members  Leader: ${g.leader}`,'sys'));break;
    }
    case'chat':case'gc':{
      if(!p.guildId)return say(ws,'Not in a guild.','err');
      if(!rest)return say(ws,'GC [message]','err');
      const g=guilds[p.guildId];
      [...sessions.values()].filter(x=>x.loggedIn&&x.guildId===p.guildId)
        .forEach(x=>say(x.ws,`[${g.name}] ${p.name}: ${rest}`,'tell'));break;
    }
    case'deposit':{
      if(!p.guildId)return say(ws,'Not in a guild.','err');
      const amt=parseInt(rest);if(isNaN(amt)||amt<1)return say(ws,'GUILD DEPOSIT [amount]','err');
      if(p.gold<amt)return say(ws,`Not enough gold.`,'err');
      p.gold-=amt;guilds[p.guildId].bank+=amt;saveGuilds();svc(p);
      say(ws,`Deposited ${amt}g. Bank total: ${guilds[p.guildId].bank}g.`,'ok');break;
    }
    case'withdraw':{
      if(!p.guildId)return say(ws,'Not in a guild.','err');
      const g=guilds[p.guildId];
      if(g.leader!==p.username)return say(ws,'Only the leader can withdraw.','err');
      const amt=parseInt(rest);if(isNaN(amt)||amt<1||g.bank<amt)return say(ws,`Can't withdraw ${amt}g. Bank has ${g.bank}g.`,'err');
      g.bank-=amt;p.gold+=amt;saveGuilds();svc(p);say(ws,`Withdrew ${amt}g.`,'ok');break;
    }
    case'motd':{
      if(!p.guildId)return say(ws,'Not in a guild.','err');
      const g=guilds[p.guildId];
      if(g.leader!==p.username)return say(ws,'Only the leader can set MOTD.','err');
      g.motd=rest.slice(0,100);saveGuilds();
      [...sessions.values()].filter(x=>x.loggedIn&&x.guildId===p.guildId)
        .forEach(x=>say(x.ws,`[${g.name}] MOTD: ${g.motd}`,'narrate'));break;
    }
    default:say(ws,'GUILD: CREATE JOIN LEAVE INFO LIST CHAT DEPOSIT WITHDRAW MOTD','sys');
  }
}

function doGuildHall(ws,p){
  if(!p.guildId||!guilds[p.guildId])return say(ws,'Not in a guild. Visit the Guild District (north of Temple).','err');
  const g=guilds[p.guildId];
  const hallId='hall_'+p.guildId;
  world[hallId]={zone:'GUILD HALLS',name:`${g.name} Hall`,
    desc:`The guild hall of ${g.name}.${g.motd?' The sign reads: "'+g.motd+'"':''} Trophies and banners decorate the walls.`,
    exits:{out:'guild_hall_row'},items:[],monsters:[],shop:null};
  p.room=hallId;describeRoom(ws,p);
  say(ws,'','sys');
  say(ws,`─── ${g.name} ─ Guild Info ─────────────`,'loot');
  say(ws,`  Leader: ${g.leader}  Members: ${g.members.length}  Bank: ${g.bank}g`,'sys');
  g.members.forEach(u=>{
    const m=[...sessions.values()].find(x=>x.username===u&&x.loggedIn);
    say(ws,m?`  ✓ ${m.name} the ${m.raceName} ${m.className} Lv${m.level}`:`  ○ ${u} (offline)`,'sys');
  });
  say(ws,'  GC [msg] for guild chat  |  OUT to leave','sys');
  sidebar(ws,p);
}

// ── Party commands ────────────────────────────────────────────────────────
function partyCmd(ws,p,sub,rest){
  switch(sub){
    case'invite':{
      if(!rest)return say(ws,'PARTY INVITE [player]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===rest.toLowerCase());
      if(!tgt)return say(ws,`${rest} is not online.`,'err');
      let myP=getParty(p.username);
      if(!myP){const pid=`p${++partySeq}`;parties.set(pid,{leader:p.username,members:new Set([p.username]),invites:new Set()});myP=getParty(p.username);checkAch(ws,p,'party_up');}
      const party=parties.get(myP.id);
      if(party.leader!==p.username)return say(ws,'Only the leader can invite.','err');
      party.invites.add(tgt.username);
      say(ws,`Party invite sent to ${tgt.name}.`,'ok');
      say(tgt.ws,`${p.name} invites you to their party! PARTY JOIN ${p.name} to accept.`,'ok');break;
    }
    case'join':{
      if(!rest)return say(ws,'PARTY JOIN [leader name]','err');
      const ldr=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===rest.toLowerCase());
      if(!ldr)return say(ws,'Player not found.','err');
      const lp=getParty(ldr.username);if(!lp)return say(ws,'That player is not in a party.','err');
      const party=parties.get(lp.id);
      if(!party.invites.has(p.username))return say(ws,'You have not been invited.','err');
      if(getParty(p.username))return say(ws,'Already in a party. PARTY LEAVE first.','err');
      party.invites.delete(p.username);party.members.add(p.username);
      checkAch(ws,p,'party_up');
      [...party.members].forEach(u=>{const m=[...sessions.values()].find(x=>x.username===u&&x.loggedIn);if(m)say(m.ws,`${p.name} joined the party!`,'ok');});break;
    }
    case'leave':{
      const myP=getParty(p.username);if(!myP)return say(ws,'Not in a party.','err');
      const party=parties.get(myP.id);party.members.delete(p.username);say(ws,'You leave the party.','ok');
      if(party.members.size===0)parties.delete(myP.id);
      else{if(party.leader===p.username)party.leader=[...party.members][0];
        [...party.members].forEach(u=>{const m=[...sessions.values()].find(x=>x.username===u&&x.loggedIn);if(m)say(m.ws,`${p.name} left the party.`,'sys');});}break;
    }
    case'follow':{
      const myP=getParty(p.username);if(!myP)return say(ws,'Not in a party.','err');
      const party=parties.get(myP.id);
      if(party&&party.leader===p.username)return say(ws,'You are the leader — members follow you automatically when PARTY FOLLOW is on.','sys');
      p.partyFollow=!p.partyFollow;
      say(ws,p.partyFollow?'Now following the party leader. They move, you move.':'Stopped following.','ok');break;
    }
    case'info':case'':case undefined:{
      const myP=getParty(p.username);if(!myP)return say(ws,'Not in a party. PARTY INVITE [player] to start one.','sys');
      const party=parties.get(myP.id);if(!party)return;
      say(ws,'─── Party ───────────────────────────','sys');
      [...party.members].forEach(u=>{const m=[...sessions.values()].find(x=>x.username===u&&x.loggedIn);if(m)say(ws,`  ${m.name} Lv${m.level}${party.leader===u?' [Leader]':''}${m.partyFollow?' →':''}  — ${world[m.room]?.name||m.room}`,'sys');});break;
    }
    case'chat':case'pc':{
      const myP=getParty(p.username);if(!myP)return say(ws,'Not in a party.','err');
      if(!rest)return say(ws,'PC [message]','err');
      const party=parties.get(myP.id);if(!party)return;
      [...party.members].forEach(u=>{const m=[...sessions.values()].find(x=>x.username===u&&x.loggedIn);if(m)say(m.ws,`[Party] ${p.name}: ${rest}`,'tell');});break;
    }
    case'kick':{
      const myP=getParty(p.username);if(!myP)return say(ws,'Not in a party.','err');
      const party=parties.get(myP.id);if(!party||party.leader!==p.username)return say(ws,'Only the leader can kick.','err');
      if(!rest)return say(ws,'PARTY KICK [player]','err');
      const kt=[...party.members].find(u=>{const m=[...sessions.values()].find(x=>x.username===u);return m&&m.name.toLowerCase()===rest.toLowerCase();});
      if(!kt)return say(ws,'Not in your party.','err');
      party.members.delete(kt);
      const kws=[...sessions.entries()].find(([,x])=>x.username===kt);
      if(kws)say(kws[0],`You were kicked by ${p.name}.`,'err');
      say(ws,`${rest} kicked.`,'ok');break;
    }
    default:say(ws,'PARTY: INVITE JOIN LEAVE FOLLOW INFO CHAT KICK','sys');
  }
}

// ── Trade ─────────────────────────────────────────────────────────────────
const pendingTrades=new Map();
function tradeCmd(ws,p,rest){
  const parts=(rest||'').split(' '),sub=parts[0].toLowerCase();
  if(sub==='cancel'){pendingTrades.delete(p.username);say(ws,'Trade cancelled.','ok');return;}
  if(sub==='offer'){
    const t=pendingTrades.get(p.username);if(!t)return say(ws,'No active trade. TRADE [player] to start.','err');
    const q=parts.slice(1).join(' ');const gold=parseInt(q);
    if(!isNaN(gold)&&gold>0){
      if(p.gold<gold)return say(ws,`Not enough gold.`,'err');
      t.offeredGold=(t.offeredGold||0)+gold;say(ws,`Added ${gold}g to offer.`,'ok');
    }else{
      const idx=p.inventory.findIndex(i=>i.toLowerCase().includes(q.toLowerCase()));
      if(idx===-1)return say(ws,"You don't have that.",'err');
      t.offeredItems.push(p.inventory[idx]);say(ws,`Added ${p.inventory[idx]} to offer.`,'ok');
    }
    const partner=[...sessions.values()].find(x=>x.username===t.with&&x.loggedIn);
    const offerText=`${p.name} offers: ${t.offeredItems.join(', ')||'nothing'}${t.offeredGold?` + ${t.offeredGold}g`:''}`;
    say(ws,offerText,'shop');if(partner)say(partner.ws,offerText,'shop');return;
  }
  if(sub==='confirm'){
    const t=pendingTrades.get(p.username);if(!t)return say(ws,'No active trade.','err');
    const partner=[...sessions.values()].find(x=>x.username===t.with&&x.loggedIn);
    if(!partner)return say(ws,'Trade partner is offline.','err');
    const pt=pendingTrades.get(t.with);
    if(!pt||!pt.confirmed){t.confirmed=true;say(ws,'Confirmed. Waiting for partner (TRADE CONFIRM).','ok');if(partner)say(partner.ws,`${p.name} confirmed. TRADE CONFIRM to complete.`,'ok');return;}
    // Execute
    t.offeredItems.forEach(item=>{const i=p.inventory.indexOf(item);if(i>=0)p.inventory.splice(i,1);partner.inventory.push(item);});
    pt.offeredItems.forEach(item=>{const i=partner.inventory.indexOf(item);if(i>=0)partner.inventory.splice(i,1);p.inventory.push(item);});
    p.gold-=(t.offeredGold||0);partner.gold+=(t.offeredGold||0);
    partner.gold-=(pt.offeredGold||0);p.gold+=(pt.offeredGold||0);
    pendingTrades.delete(p.username);pendingTrades.delete(t.with);
    say(ws,`✓ Trade complete! Received: ${pt.offeredItems.join(', ')||'nothing'}${pt.offeredGold?` + ${pt.offeredGold}g`:''}`,'ok');
    say(partner.ws,`✓ Trade complete! Received: ${t.offeredItems.join(', ')||'nothing'}${t.offeredGold?` + ${t.offeredGold}g`:''}`,'ok');
    svc(p);svc(partner);sidebar(ws,p);sidebar(partner.ws,partner);return;
  }
  const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===rest.toLowerCase());
  if(!tgt)return say(ws,`${rest} is not online.`,'err');
  if(tgt.username===p.username)return say(ws,"Can't trade with yourself.",'err');
  pendingTrades.set(p.username,{with:tgt.username,offeredItems:[],offeredGold:0,confirmed:false});
  pendingTrades.set(tgt.username,{with:p.username,offeredItems:[],offeredGold:0,confirmed:false});
  say(ws,`Trade opened with ${tgt.name}. TRADE OFFER [item/gold], then TRADE CONFIRM.`,'shop');
  say(tgt.ws,`${p.name} wants to trade! TRADE OFFER [item/gold], TRADE CONFIRM, or TRADE CANCEL.`,'shop');
}

// ── Admin commands ────────────────────────────────────────────────────────
function adminCmd(ws,p,raw){
  const parts=raw.trim().split(/\s+/),v=parts[0].toLowerCase(),rest=parts.slice(1).join(' ');
  say(ws,`[ADMIN] ${raw}`,'loot');
  switch(v){
    case'/ci':{
      const m=rest.match(/^"([^"]+)"\s+(\w+)\s+(-?\d+)\s+(-?\d+)\s*(.*)$/)||rest.match(/^(\S+)\s+(\w+)\s+(-?\d+)\s+(-?\d+)\s*(.*)$/);
      if(!m)return say(ws,'Usage: /ci "Item Name" [weapon/armor/potion] [atk] [def] [desc]','err');
      const[,name,type,atk,def,desc]=m;
      if(type==='weapon'||type==='armor')EQ[name.toLowerCase()]={t:type,atk:parseInt(atk),def:parseInt(def)};
      p.inventory.push(name);say(ws,`✓ Created "${name}" (${type}) ATK:${atk} DEF:${def} — added to your inventory.`,'ok');sidebar(ws,p);break;
    }
    case'/give':case'/g':{
      const pp=rest.split(' '),tn=pp[0],item=pp.slice(1).join(' ');
      if(!tn||!item)return say(ws,'Usage: /give [player] [item]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===tn.toLowerCase());
      if(!tgt)return say(ws,`${tn} not online.`,'err');
      tgt.inventory.push(item);svc(tgt);sidebar(tgt.ws,tgt);
      say(ws,`✓ Gave "${item}" to ${tgt.name}.`,'ok');say(tgt.ws,`✨ ${p.name} gifted you: ${item}!`,'loot');break;
    }
    case'/gg':{
      const pp=rest.split(' '),tn=pp[0],amt=parseInt(pp[1]);
      if(!tn||isNaN(amt))return say(ws,'Usage: /gg [player] [amount]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===tn.toLowerCase());
      if(!tgt)return say(ws,`${tn} not online.`,'err');
      tgt.gold+=amt;svc(tgt);sidebar(tgt.ws,tgt);
      say(ws,`✓ Gave ${amt}g to ${tgt.name}.`,'ok');say(tgt.ws,`✨ ${p.name} granted you ${amt} gold!`,'loot');
      bAll({type:'line',text:`✨ ${tgt.name} has been blessed with gold by the Administrator!`,cls:'loot'});break;
    }
    case'/xp':{
      const pp=rest.split(' '),tn=pp[0],amt=parseInt(pp[1]);
      if(!tn||isNaN(amt))return say(ws,'Usage: /xp [player] [amount]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===tn.toLowerCase());
      if(!tgt)return say(ws,`${tn} not online.`,'err');
      tgt.xp+=amt;levelUp(tgt.ws,tgt);svc(tgt);sidebar(tgt.ws,tgt);
      say(ws,`✓ Gave ${amt} XP to ${tgt.name}.`,'ok');break;
    }
    case'/sl':{
      const pp=rest.split(' '),tn=pp[0],lvl=parseInt(pp[1]);
      if(!tn||isNaN(lvl))return say(ws,'Usage: /sl [player] [level]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===tn.toLowerCase());
      if(!tgt)return say(ws,`${tn} not online.`,'err');
      tgt.level=lvl;tgt.maxhp=30+lvl*12;tgt.hp=tgt.maxhp;tgt.atk=CLASSES[tgt.classId]?.atk+RACES[tgt.raceId]?.atk+(lvl-1)*2||tgt.atk;tgt.def=CLASSES[tgt.classId]?.def+RACES[tgt.raceId]?.def+(lvl-1)||tgt.def;tgt.xp=0;svc(tgt);sidebar(tgt.ws,tgt);
      say(ws,`✓ Set ${tgt.name} to Level ${lvl}.`,'ok');say(tgt.ws,`✨ Your level was set to ${lvl}!`,'loot');break;
    }
    case'/heal':{
      const tn=rest||p.name;
      const tgt=tn===p.name?p:[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===tn.toLowerCase());
      if(!tgt)return say(ws,`${tn} not found.`,'err');
      tgt.hp=tgt.maxhp;tgt.inCombat=false;tgt.enemy=null;svc(tgt);sidebar(tgt.ws,tgt);
      say(ws,`✓ ${tgt.name} fully healed.`,'ok');if(tgt!==p)say(tgt.ws,`✨ Fully restored by ${p.name}!`,'ok');break;
    }
    case'/spawn':{
      if(!rest)return say(ws,'Usage: /spawn [item name]','err');
      if(!world[p.room])return say(ws,'Invalid room.','err');
      world[p.room].items.push(rest);
      say(ws,`✓ Spawned "${rest}" in ${world[p.room].name}.`,'ok');
      sayRoom(p.room,`A shimmer — "${rest}" appears on the ground!`,'loot',ws);break;
    }
    case'/goto':{
      if(!rest||!world[rest])return say(ws,`Room "${rest}" not found. Use /rooms to list.`,'err');
      p.room=rest;p.inCombat=false;p.enemy=null;describeRoom(ws,p);sidebar(ws,p);break;
    }
    case'/tp':{
      const pp=rest.split(' '),tn=pp[0],dest=pp[1];
      if(!tn||!dest)return say(ws,'Usage: /tp [player] [room_id / here]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===tn.toLowerCase());
      if(!tgt)return say(ws,`${tn} not online.`,'err');
      const rd=dest==='here'?p.room:dest;
      if(!world[rd])return say(ws,`Room "${rd}" not found.`,'err');
      tgt.room=rd;tgt.inCombat=false;tgt.enemy=null;describeRoom(tgt.ws,tgt);svc(tgt);sidebar(tgt.ws,tgt);
      say(ws,`✓ Teleported ${tgt.name} to ${world[rd].name}.`,'ok');say(tgt.ws,`✨ Teleported by ${p.name}.`,'loot');break;
    }
    case'/rooms':{
      say(ws,'─── All Rooms ─────────────────────────','sys');
      Object.entries(world).forEach(([id,rm])=>say(ws,`  ${id.padEnd(22)} ${rm.zone} — ${rm.name}`,'sys'));break;
    }
    case'/announce':case'/ann':{
      if(!rest)return say(ws,'Usage: /announce [message]','err');
      bAll({type:'line',text:`📢 ANNOUNCEMENT: ${rest}`,cls:'loot'});
      say(ws,`✓ Announced to all online players.`,'ok');break;
    }
    case'/players':case'/who':{
      const online=[...sessions.values()].filter(x=>x.loggedIn);
      say(ws,`─── Online (${online.length}) ─────────────────────────────────`,'sys');
      online.forEach(x=>say(ws,`  ${x.name.padEnd(16)} Lv${String(x.level).padStart(2)} ${x.raceName} ${x.className} — ${world[x.room]?.name||x.room} | HP:${x.hp}/${x.maxhp} Gold:${x.gold}`,'sys'));break;
    }
    case'/kick':{
      if(!rest)return say(ws,'Usage: /kick [player]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===rest.toLowerCase());
      if(!tgt)return say(ws,`${rest} not found.`,'err');
      say(tgt.ws,'You have been disconnected by the Administrator.','err');svc(tgt);
      setTimeout(()=>{try{tgt.ws.close();}catch{}},500);say(ws,`✓ Kicked ${tgt.name}.`,'ok');break;
    }
    case'/take':{
      const pp=rest.split(' '),tn=pp[0],q=pp.slice(1).join(' ');
      if(!tn||!q)return say(ws,'Usage: /take [player] [item]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===tn.toLowerCase());
      if(!tgt)return say(ws,`${tn} not found.`,'err');
      const idx=tgt.inventory.findIndex(i=>i.toLowerCase().includes(q.toLowerCase()));
      if(idx===-1)return say(ws,`${tgt.name} doesn't have that.`,'err');
      const removed=tgt.inventory.splice(idx,1)[0];svc(tgt);sidebar(tgt.ws,tgt);
      say(ws,`✓ Removed "${removed}" from ${tgt.name}.`,'ok');break;
    }
    case'/setstat':{
      const pp=rest.split(' '),tn=pp[0],stat=pp[1],val=parseInt(pp[2]);
      if(!tn||!stat||isNaN(val))return say(ws,'Usage: /setstat [player] [hp/maxhp/atk/def/gold] [value]','err');
      const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===tn.toLowerCase());
      if(!tgt)return say(ws,`${tn} not found.`,'err');
      if(!['hp','maxhp','atk','def','gold'].includes(stat))return say(ws,'Stat must be hp/maxhp/atk/def/gold','err');
      tgt[stat]=val;if(stat==='maxhp')tgt.hp=val;svc(tgt);sidebar(tgt.ws,tgt);
      say(ws,`✓ Set ${tgt.name}'s ${stat} to ${val}.`,'ok');break;
    }
    case'/help':case'/?':{
      say(ws,'═══ ADMIN COMMANDS ════════════════════════','loot');
      say(ws,' /ci "Name" type atk def [desc]  Create item','sys');
      say(ws,' /give [player] [item]            Give item','sys');
      say(ws,' /take [player] [item]            Remove item','sys');
      say(ws,' /spawn [item]                   Spawn in room','sys');
      say(ws,' /gg [player] [gold]             Give gold','sys');
      say(ws,' /xp [player] [amount]           Give XP','sys');
      say(ws,' /sl [player] [level]            Set level','sys');
      say(ws,' /setstat [player] [stat] [val]  Set stat','sys');
      say(ws,' /heal [player]                  Fully heal','sys');
      say(ws,' /goto [room_id]                 Teleport self','sys');
      say(ws,' /tp [player] [room/here]        Teleport player','sys');
      say(ws,' /rooms                          List all rooms','sys');
      say(ws,' /announce [msg]                 Server announce','sys');
      say(ws,' /players                        Detailed who list','sys');
      say(ws,' /kick [player]                  Disconnect player','sys');
      break;
    }
    default:say(ws,`Unknown admin command. Type /help.`,'err');
  }
}


// ── Main command handler ──────────────────────────────────────────────────
const DIRS={n:'north',s:'south',e:'east',w:'west',u:'up',d:'down',o:'out',
  north:'north',south:'south',east:'east',west:'west',up:'up',down:'down',out:'out'};
const OPP={north:'south',south:'north',east:'west',west:'east',up:'below',down:'above',out:'outside'};

function handleCmd(ws,p,raw){
  const input=raw.trim().toLowerCase();if(!input)return;
  say(ws,`> ${raw}`,'prompt');

  // Admin slash commands
  if(input.startsWith('/')){
    if(!p.isAdmin)return say(ws,"Unknown command. Type HELP.",'err');
    adminCmd(ws,p,raw);return;
  }

  // Parse command and args early so alias resolution works
  const _words=input.split(/\s+/),v=_words[0],rest=_words.slice(1).join(' ');

  // Resolve aliases before processing
  const aliasResolved=(p.aliases||{})[v];
  if(aliasResolved&&v!==aliasResolved.split(' ')[0]){
    return handleCmd(ws,p,aliasResolved+(rest?' '+rest:''));
  }
  // ── COMBAT MODE ──────────────────────────────────────────────────────────
  if(p.inCombat){
    const m=p.enemy;
    if(!m||m.dead){p.inCombat=false;p.enemy=null;return;}
    if(v==='flee'||v==='run'){
      if((p.rageT||0)>0)return say(ws,'Cannot flee while raging!','err');
      const exits=Object.keys((world[p.room]?.exits)||{});
      if(!exits.length)return say(ws,'Nowhere to flee!','err');
      const dir=exits[0];p.room=world[p.room].exits[dir];p.inCombat=false;p.enemy=null;
      say(ws,`You flee ${dir}!`,'narrate');describeRoom(ws,p);sidebar(ws,p);return;
    }
    if(v==='use'){
      const q=_words.slice(1).join(' ');
      const name=p.inventory.find(i=>i.toLowerCase().includes(q));
      if(!name)return say(ws,"You don't have that.",'err');
      if(!useConsumable(ws,p,name))return say(ws,"Can't use that in combat.",'err');
      p.inventory.splice(p.inventory.indexOf(name),1);
      monsterAttack(ws,p,m);sidebar(ws,p);return;
    }
    // Skill execution
    const cls=CLASSES[p.classId];
    const allSkills=[...(cls?.skills||[]),...(p.extraSkills||[])];const findSid=q=>allSkills.find(s=>{const sk=SK[s];return sk&&(sk.n.toLowerCase().includes(q)||s===q.replace(/ /g,'_'));});
    if(v==='skill'||v==='cast'){
      const sid=findSid(_words.slice(1).join(' '));
      if(!sid)return say(ws,'Unknown skill. Type SKILLS.','err');
      const cd=(p.cd||{})[sid]||0;if(cd>0)return say(ws,`${SK[sid].n} on cooldown: ${cd} turns.`,'err');
      if(!p.cd)p.cd={};
      const res=execSkill(ws,p,sid,m);
      p.cd[sid]=SK[sid].cd;
      if(res==='fled'){sidebar(ws,p);return;}
      if(m.hp<=0||m.dead)return killMonster(ws,p,m);
      if(!p.inCombat){sidebar(ws,p);return;}
      monsterAttack(ws,p,m);sidebar(ws,p);return;
    }
    if(['attack','a','fight','hit','strike'].includes(v)){playerAttack(ws,p);sidebar(ws,p);return;}
    // Bare skill name
    const sid=findSid(input);
    if(sid){
      const cd=(p.cd||{})[sid]||0;if(cd>0)return say(ws,`${SK[sid].n} on cooldown: ${cd} turns.`,'err');
      if(!p.cd)p.cd={};
      const res=execSkill(ws,p,sid,m);p.cd[sid]=SK[sid].cd;
      if(res==='fled'){sidebar(ws,p);return;}
      if(m.hp<=0||m.dead)return killMonster(ws,p,m);
      if(!p.inCombat){sidebar(ws,p);return;}
      monsterAttack(ws,p,m);sidebar(ws,p);
    }else say(ws,'ATTACK / FLEE / USE [item] / SKILL [name]','sys');
    return;
  }

  // ── NORMAL MODE ──────────────────────────────────────────────────────────

  if(DIRS[v]){
    const dir=DIRS[v],rm=world[p.room];
    if(!rm){
      console.error('[MOVE] Room not found:',p.room,'for player',p.username);
      p.room='town_square';
      return say(ws,"Something went wrong. Returning to Town Square.",'err');
    }
    if(!rm.exits||!rm.exits[dir])return say(ws,"You can't go that way.",'err');
    sayRoom(p.room,`${p.name} heads ${dir}.`,'narrate',ws);
    p.room=rm.exits[dir];say(ws,`You head ${dir}.`,'narrate');
    describeRoom(ws,p);sayRoom(p.room,`${p.name} arrives from the ${OPP[dir]||'elsewhere'}.`,'narrate',ws);sidebar(ws,p);
    // Party follow
    const myP=getParty(p.username);
    if(myP){
      const party=parties.get(myP.id);
      if(party&&party.leader===p.username){
        [...party.members].forEach(u=>{
          if(u===p.username)return;
          const mate=[...sessions.values()].find(x=>x.username===u&&x.loggedIn);
          if(!mate||!mate.partyFollow||mate.inCombat)return;
          if(!world[mate.room]?.exits?.[dir]){say(mate.ws,`[Party] No ${dir} exit — couldn't follow ${p.name}.`,'sys');return;}
          mate.room=world[mate.room].exits[dir];
          say(mate.ws,`[Party] You follow ${p.name} ${dir}.`,'narrate');
          describeRoom(mate.ws,mate);sidebar(mate.ws,mate);
        });
      }
    }
    // Auto-engage — 30% chance monsters attack on entry
    const hostiles=(world[p.room]?.monsters||[]).filter(m=>!m.dead);
    if(hostiles.length){
      if(rnd(1,100)<=30){
        // Monster attacks!
        p.inCombat=true;p.enemy=hostiles[0];
        say(ws,`The ${hostiles[0].name} snarls and lunges at you!`,'combat');
        say(ws,'ATTACK / FLEE / SKILL [name]  — or try to LOOK at it first.','sys');
        // Send portrait
        const _ap=MOB_PORTRAITS[hostiles[0].name];
        if(_ap)raw(ws,{type:'mob_portrait',name:hostiles[0].name,img:'/monsters/'+_ap,hp:hostiles[0].hp,maxhp:hostiles[0].maxhp,atk:hostiles[0].atk,def:hostiles[0].def});
      }else{
        // Monster is present but not attacking — player can look or choose to engage
        const _idleLines=[
          `A ${hostiles[0].name} watches you warily.`,
          `A ${hostiles[0].name} paces nearby, not yet attacking.`,
          `A ${hostiles[0].name} eyes you with suspicion but holds back.`,
          `A ${hostiles[0].name} growls low — it hasn't attacked yet.`,
          `A ${hostiles[0].name} is here. It hasn't noticed you yet.`
        ];
        say(ws,_idleLines[rnd(0,_idleLines.length-1)],'narrate');
        say(ws,`ATTACK to engage, or LOOK ${hostiles[0].name.split(' ')[0].toLowerCase()} to examine it.`,'sys');
      }
    }
    return;
  }

  switch(v){
    case'look':case'l':{
      if(rest){
        // Check for NPC in room first
        const npcMatch=Object.values(NPCS).find(n=>n.room===p.room&&n.name.toLowerCase().includes(rest.toLowerCase()));
        if(npcMatch){showNPCProfile(ws,npcMatch);break;}
        // Check for monster in room
        const mobMatch=(world[p.room]?.monsters||[]).find(m=>!m.dead&&m.name.toLowerCase().includes(rest.toLowerCase()));
        if(mobMatch){showMobProfile(ws,mobMatch);break;}
        const tgt=[...sessions.values()].find(x=>x.loggedIn&&x.name&&x.name.toLowerCase()===rest.toLowerCase());
        if(tgt){showProfile(ws,p,tgt);break;}
        const allItems=[...p.inventory,...(world[p.room]?.items||[]),...p.equipped];
        const f=allItems.find(i=>i.toLowerCase().includes(rest));
        if(f){
          const st=EQ[f.toLowerCase()];
          if(st){
            const desc=st.desc?` "${st.desc}"`:'';
            say(ws,`${f} [${st.t.toUpperCase()}] ATK:${st.atk>=0?'+':''}${st.atk} DEF:${st.def>=0?'+':''}${st.def}${desc}`,'narrate');
          }else{say(ws,`${f}: A useful item.`,'narrate');}
          break;
        }
      }
      describeRoom(ws,p);break;
    }
    case'take':case'get':{
      const rm=world[p.room];if(!rm)break;
      const idx=(rm.items||[]).findIndex(i=>i.toLowerCase().includes(rest));
      if(idx===-1)return say(ws,`No '${rest}' here.`,'err');
      const it=rm.items.splice(idx,1)[0];p.inventory.push(it);
      say(ws,`You pick up the ${it}.`,'ok');
      const eqCheck=EQ[it.toLowerCase()];
      if(eqCheck)say(ws,`  [${eqCheck.t.toUpperCase()}] ATK+${eqCheck.atk} DEF+${eqCheck.def} — type EQUIP ${it} to use it.`,'sys');
      sidebar(ws,p);break;
    }
    case'drop':{
      const idx=p.inventory.findIndex(i=>i.toLowerCase().includes(rest));
      if(idx===-1)return say(ws,"You don't have that.",'err');
      const it=p.inventory.splice(idx,1)[0];if(world[p.room])world[p.room].items.push(it);say(ws,`You drop the ${it}.`,'ok');sidebar(ws,p);break;
    }
    case'use':{
      const idx=p.inventory.findIndex(i=>i.toLowerCase().includes(rest));
      if(idx===-1)return say(ws,`You don't have '${rest}'.`,'err');
      const name=p.inventory[idx];
      if(useConsumable(ws,p,name)){p.inventory.splice(idx,1);sidebar(ws,p);return;}
      if(EQ[name.toLowerCase()]){
        if(doEquip(p,name,false)){const st=EQ[name.toLowerCase()];let msg=`Equipped ${name}.`;if(st){if(st.atk>0)msg+=` ATK+${st.atk}.`;if(st.def>0)msg+=` DEF+${st.def}.`;}say(ws,msg,'ok');sidebar(ws,p);}
        else say(ws,`Can't equip ${name}.`,'err');return;
      }
      if(name==='ancient tome'){p.atk+=4;p.inventory.splice(idx,1);say(ws,'ATK permanently +4!','ok');sidebar(ws,p);return;}
      if(name==='crude map'){showMap(ws);return;}
      say(ws,`Not sure how to use the ${name}.`,'sys');break;
    }
    case'equip':case'wear':case'wield':{
      const name=p.inventory.find(i=>i.toLowerCase().includes(rest));
      if(!name)return say(ws,"You don't have that.",'err');
      if(doEquip(p,name,false)){const st=EQ[name.toLowerCase()];let msg=`Equipped ${name}.`;if(st){if(st.atk>0)msg+=` ATK+${st.atk}.`;if(st.def>0)msg+=` DEF+${st.def}.`;}say(ws,msg,'ok');sidebar(ws,p);}
      else say(ws,`Can't equip ${name}.`,'err');break;
    }
    case'unequip':case'remove':{
      const name=p.equipped.find(e=>e.toLowerCase().includes(rest));
      if(!name)return say(ws,'Not equipped.','err');
      doUnequip(p,name,false);say(ws,`Unequipped ${name}.`,'ok');sidebar(ws,p);break;
    }
    case'attack':case'fight':case'kill':{
      if(!world[p.room])return;
      const hostiles=(world[p.room].monsters||[]).filter(m=>!m.dead);
      if(!hostiles.length)return say(ws,'Nothing to attack here.','err');
      const m=(rest&&hostiles.find(x=>x.name.toLowerCase().includes(rest)))||hostiles[0];
      p.inCombat=true;p.enemy=m;
      say(ws,`You engage ${m.name}! [HP:${m.hp}/${m.maxhp}]`,'combat');
      say(ws,'ATTACK / FLEE / SKILL [name] / USE [item]','sys');
      sayRoom(p.room,`${p.name} engages ${m.name}!`,'combat',ws);sidebar(ws,p);break;
    }
    case'skill':case'cast':{
      const cls=CLASSES[p.classId];
      const sid=(cls?.skills||[]).find(s=>{const sk=SK[s];return sk&&(sk.n.toLowerCase().includes(rest)||s===rest.replace(/ /g,'_'));});
      if(!sid)return say(ws,'Unknown skill. Type SKILLS.','err');
      if(SK[sid].cmb)return say(ws,`${SK[sid].n} is combat-only.`,'err');
      const cd=(p.cd||{})[sid]||0;if(cd>0)return say(ws,`${SK[sid].n} on cooldown: ${cd} turns.`,'err');
      if(!p.cd)p.cd={};execSkill(ws,p,sid,null);p.cd[sid]=SK[sid].cd;sidebar(ws,p);break;
    }
    case'skills':case'abilities':{
      const cls=CLASSES[p.classId];if(!cls)return;
      say(ws,`─── ${cls.name} Skills ─────────────────────`,'sys');
      (cls.skills||[]).forEach(sid=>{const sk=SK[sid];if(!sk)return;const cd=(p.cd||{})[sid]||0;say(ws,`  ${sk.n.padEnd(18)}${sk.cmb?'':'✦ '}${cd>0?`[cd:${cd}]`:'[READY]'}`,'sys');});
      if(p.extraSkills&&p.extraSkills.length){
        say(ws,'  ─── Specialization Skills ──────────────','sys');
        p.extraSkills.forEach(sid=>{const sk=SK[sid];if(!sk)return;const cd=(p.cd||{})[sid]||0;say(ws,`  ${sk.n.padEnd(18)}${sk.cmb?'':'✦ '}${cd>0?`[cd:${cd}]`:'[READY]'} ★`,'skill');});
      }
      say(ws,'  ✦ = usable outside combat  ★ = specialization','sys');break;
    }
    case'tame':doTame(ws,p);break;
    case'dismiss':{if(!p.companion)return say(ws,'No companion.','sys');say(ws,`${p.companion.name} parts ways.`,'narrate');p.companion=null;sidebar(ws,p);break;}
    case'companion':case'pet':{if(!p.companion)return say(ws,'No companion.','sys');say(ws,`🐾 ${p.companion.name} HP:${p.companion.hp}/${p.companion.maxhp} ATK:${p.companion.atk}`,'narrate');break;}
    case'zombies':{if(!p.zombies||!p.zombies.length)return say(ws,'No zombies.','sys');p.zombies.forEach((z,i)=>say(ws,`  Zombie ${i+1}: ${z.name} [HP:${z.hp} ATK:${z.atk}]`,'narrate'));break;}
    case'shop':case'list':{
      const sk=world[p.room]?.shop;if(!sk)return say(ws,'No shop here.','err');
      const sh=SHOPS[sk];say(ws,`╔══ ${sh.name} ══╗`,'shop');say(ws,sh.greet,'narrate');
      sh.items.forEach((it,i)=>{
        let ln=`  [${i+1}] ${it.name.padEnd(22)} ${it.cost}g`;
        if(it.atk>0)ln+=` ATK+${it.atk}`;if(it.def>0)ln+=` DEF+${it.def}`;
        if(it.heal>0&&it.heal<9999)ln+=` +${it.heal}HP`;if(it.heal>=9999)ln+=' Full HP';
        if(it.t==='pet')ln+=` [PET]`;say(ws,ln,'shop');
      });
      say(ws,`${p.gold}g  |  BUY [name]  |  SELL [name]`,'sys');break;
    }
    case'buy':{
      const sk=world[p.room]?.shop;if(!sk)return say(ws,'No shop here.','err');
      const sh=SHOPS[sk];
      if(sk==='pet_store'){
        const pet=sh.items.find(i=>i.name.toLowerCase().includes(rest));
        if(!pet)return say(ws,'That pet is not available. Type SHOP.','err');
        if(p.companion)return say(ws,`Already have ${p.companion.name}. DISMISS first.`,'err');
        if(p.gold<pet.cost)return say(ws,`Need ${pet.cost}g, have ${p.gold}g.`,'err');
        p.gold-=pet.cost;p.companion={name:pet.name,atk:pet.atk,hp:pet.hp,maxhp:pet.hp};
        say(ws,`You buy the ${pet.name} for ${pet.cost}g! A new companion joins you.`,'ok');sidebar(ws,p);break;
      }
      const it=sh.items.find(i=>i.name.toLowerCase().includes(rest));
      if(!it)return say(ws,'Not sold here. Type SHOP.','err');
      if(p.gold<it.cost)return say(ws,`Need ${it.cost}g, have ${p.gold}g.`,'err');
      p.gold-=it.cost;p.inventory.push(it.name);
      if((it.t==='weapon'||it.t==='armor')&&!EQ[it.name.toLowerCase()])EQ[it.name.toLowerCase()]={t:it.t,atk:it.atk||0,def:it.def||0};
      say(ws,`Bought ${it.name} for ${it.cost}g.`,'ok');sidebar(ws,p);break;
    }
    case'sell':{
      if(!world[p.room]?.shop)return say(ws,'No shop here.','err');
      const idx=p.inventory.findIndex(i=>i.toLowerCase().includes(rest));
      if(idx===-1)return say(ws,"You don't have that.",'err');
      const name=p.inventory[idx];if(p.equipped.includes(name))doUnequip(p,name,true);
      let base=5;for(const sh of Object.values(SHOPS)){const fi=sh.items.find(i=>i.name===name);if(fi){base=fi.cost;break;}}
      p.inventory.splice(idx,1);p.gold+=Math.max(1,Math.floor(base*0.4));
      say(ws,`Sold ${name} for ${Math.max(1,Math.floor(base*0.4))}g.`,'ok');sidebar(ws,p);break;
    }
    case'recipes':case'crafting':{
      if(!['weaponsmith','apothecary'].includes(world[p.room]?.shop))return say(ws,'Crafting available at Weaponsmith or Apothecary.','err');
      say(ws,'─── Crafting Recipes ───────────────────────','shop');
      RECIPES.forEach((r,i)=>{
        const can=r.ing.every(ing=>p.inventory.some(x=>x.toLowerCase()===ing.toLowerCase()));
        say(ws,`  [${i+1}] ${r.name.padEnd(22)} ${r.ing.join(' + ')}${can?' [CAN CRAFT]':''}`,can?'ok':'sys');
      });
      say(ws,'CRAFT [name] to create.','sys');break;
    }
    case'craft':{
      if(!['weaponsmith','apothecary'].includes(world[p.room]?.shop))return say(ws,'Crafting available at Weaponsmith or Apothecary.','err');
      const recipe=RECIPES.find(r=>r.name.toLowerCase().includes(rest));
      if(!recipe)return say(ws,'Unknown recipe. Type RECIPES.','err');
      const missing=[];const tmp=[...p.inventory];
      for(const ing of recipe.ing){const i=tmp.findIndex(x=>x.toLowerCase()===ing.toLowerCase());if(i===-1)missing.push(ing);else tmp.splice(i,1);}
      if(missing.length)return say(ws,`Missing: ${missing.join(', ')}.`,'err');
      for(const ing of recipe.ing){const i=p.inventory.findIndex(x=>x.toLowerCase()===ing.toLowerCase());p.inventory.splice(i,1);}
      p.inventory.push(recipe.result);p.craftCount=(p.craftCount||0)+1;
      say(ws,`✓ Crafted: ${recipe.result}!`,'ok');
      checkAch(ws,p,'crafter');svc(p);sidebar(ws,p);break;
    }
    case'shrine':showShrine(ws,p);break;
    case'teleport':case'tp':doTeleport(ws,p,rest);break;
    case'bag':case'openb':case'pack':{
      // Find equipped bag
      const myBag=p.equipped.find(e=>EQ[e.toLowerCase()]&&EQ[e.toLowerCase()].t==='bag');
      if(!myBag)return say(ws,'No bag equipped. Buy one at the Weaponsmith and EQUIP it.','err');
      const bk=EQ[myBag.toLowerCase()];
      const bagContents=p.bagContents||(p.bagContents={});
      const contents=bagContents[myBag]||[];
      say(ws,`=== ${myBag} (${contents.length}/${bk.slots} slots) ===`,'loot');
      if(!contents.length)say(ws,'  Empty.','sys');
      else contents.forEach((item,i)=>say(ws,`  [${i+1}] ${item}`,'sys'));
      say(ws,'  PUT [item] IN BAG  |  TAKE [item] FROM BAG  |  BAG CAPACITY: '+bk.slots+' slots','sys');
      break;
    }
    case'put':{
      // PUT [item] IN BAG
      if(!rest.toLowerCase().includes(' in '))return say(ws,'Usage: PUT [item] IN BAG','err');
      const[itemQ,bagQ]=rest.toLowerCase().split(' in ');
      const myBag=p.equipped.find(e=>EQ[e.toLowerCase()]&&EQ[e.toLowerCase()].t==='bag'&&e.toLowerCase().includes(bagQ.trim()));
      if(!myBag)return say(ws,'No matching bag equipped.','err');
      const bk=EQ[myBag.toLowerCase()];
      if(!p.bagContents)p.bagContents={};
      if(!p.bagContents[myBag])p.bagContents[myBag]=[];
      const contents=p.bagContents[myBag];
      if(contents.length>=bk.slots)return say(ws,`${myBag} is full! (${bk.slots}/${bk.slots} slots)`,'err');
      const idx=p.inventory.findIndex(i=>i.toLowerCase().includes(itemQ.trim()));
      if(idx===-1)return say(ws,"You don't have that item in your main inventory.",'err');
      const item=p.inventory.splice(idx,1)[0];
      contents.push(item);
      say(ws,`You put the ${item} in your ${myBag}. (${contents.length}/${bk.slots} slots)`,'ok');
      sidebar(ws,p);break;
    }
    case'take':{
      // TAKE [item] FROM BAG
      if(rest.toLowerCase().includes(' from ')){
        const[itemQ,bagQ]=rest.toLowerCase().split(' from ');
        const myBag=p.equipped.find(e=>EQ[e.toLowerCase()]&&EQ[e.toLowerCase()].t==='bag'&&e.toLowerCase().includes(bagQ.trim()));
        if(!myBag)return say(ws,'No matching bag equipped.','err');
        if(!p.bagContents||!p.bagContents[myBag]||!p.bagContents[myBag].length)return say(ws,'That bag is empty.','err');
        const idx=p.bagContents[myBag].findIndex(i=>i.toLowerCase().includes(itemQ.trim()));
        if(idx===-1)return say(ws,"That item isn't in that bag.",'err');
        const item=p.bagContents[myBag].splice(idx,1)[0];
        p.inventory.push(item);
        say(ws,`You take the ${item} from your ${myBag}.`,'ok');
        sidebar(ws,p);break;
      }
      // TAKE from room (existing)
      const rm2=world[p.room];if(!rm2)break;
      const ri=( rm2.items||[]).findIndex(i=>i.toLowerCase().includes(rest));
      if(ri===-1)return say(ws,`No '${rest}' here.`,'err');
      const it2=rm2.items.splice(ri,1)[0];p.inventory.push(it2);say(ws,`You pick up the ${it2}.`,'ok');sidebar(ws,p);break;
    }
    case'inventory':case'inv':case'i':{
      if(!p.inventory.length&&!p.equipped.length)return say(ws,'Empty.','sys');
      if(p.inventory.length){
        const counts={};
        p.inventory.forEach(i=>{counts[i]=(counts[i]||0)+1;});
        const stacked=Object.entries(counts).map(([name,n])=>n>1?`(${n}) ${name}`:name);
        say(ws,'Pack: '+stacked.join(', '),'sys');
      }
      if(p.equipped.length){
        say(ws,'Equipped: '+p.equipped.join(', '),'sys');
        // Show bag summaries
        p.equipped.forEach(e=>{
          const bk=EQ[e.toLowerCase()];
          if(bk&&bk.t==='bag'){
            const bc=(p.bagContents||{})[e]||[];
            say(ws,`  ${e}: ${bc.length}/${bk.slots} slots used${bc.length?' — '+bc.slice(0,3).join(', ')+(bc.length>3?'...':''):' (empty)'}  [type BAG to open]`,'sys');
          }
        });
      }
      break;
    }
    case'stats':case'score':{
      say(ws,`─── ${p.name} ── ${p.raceName||''} ${p.className} ── Level ${p.level} ───`,'sys');
      say(ws,`HP:${p.hp}/${p.maxhp}  ATK:${p.atk}(+${p.gearAtk}gear)  DEF:${p.def}(+${p.gearDef}gear)`,'sys');
      say(ws,`Gold:${p.gold}g  XP:${p.xp}/${p.level*100}  Kills:${p.killCount||0}`,'sys');
      if(p.companion)say(ws,`Companion: ${p.companion.name} HP:${p.companion.hp} ATK:${p.companion.atk}`,'sys');
      if(p.zombies&&p.zombies.length)say(ws,`Zombies: ${p.zombies.length} under command`,'sys');break;
    }
    case'map':showMap(ws);break;
    case'who':{
      const online=[...sessions.values()].filter(x=>x.loggedIn);
      say(ws,`─── Shadowmere Online (${online.length}) ──────────────────`,'sys');
      online.forEach(x=>{
        const inParty=getParty(x.username)?'[Party]':'';
        const gld=x.guildId&&guilds[x.guildId]?`<${guilds[x.guildId].name}>`:'';
        const adm=x.isAdmin?'[ADMIN]':'';
        say(ws,`  ${x.inCombat?'⚔':' '} ${x.name}${adm} the ${x.raceName||''} ${x.className} Lv${x.level} ${gld}${inParty} — ${world[x.room]?.name||x.room}`,'sys');
      });break;
    }
    case'npcs':{
      const here=Object.values(NPCS).filter(n=>n.room===p.room);
      if(!here.length)return say(ws,'No NPCs here.','sys');
      here.forEach(n=>say(ws,`  ${n.name} — ${n.title} (TALK ${n.name.split(' ')[0].toLowerCase()})`, 'narrate'));break;
    }
    case'talk':case'speak':doTalk(ws,p,rest).catch(()=>say(ws,'(The NPC seems distracted.)','sys'));break;
    case'ask':if(!rest)return say(ws,'ASK [question]','err');doAsk(ws,p,rest).catch(()=>say(ws,'(No response.)','sys'));break;
    case'accept':{
      if(!p._pendingQ)return say(ws,'No quest to accept. TALK to an NPC first.','err');
      const qid=p._pendingQ,q=QUESTS[qid];if(!q)return;
      if(!p.quests)p.quests={};p.quests[qid]='active';p._pendingQ=null;
      say(ws,`[ Quest Accepted: ${q.title} ]`,'ok');say(ws,`Objective: ${q.obj}`,'sys');
      if(qid==='temple_blessing'){finishQuest(ws,p,qid);return;}
    // Check if it's a chain quest
    const chainDef=QUEST_CHAINS[qid];
    if(chainDef){
      if(!p.quests)p.quests={};p.quests[qid]='active';p._pendingQ=null;
      say(ws,`[ Quest Accepted: ${chainDef.title} ]`,'ok');
      say(ws,`Objective: ${chainDef.obj}`,'sys');svc(p);return;
    }
      svc(p);break;
    }
    case'quests':case'journal':case'q':{
      const qs=p.quests||{};
      const active=Object.entries(qs).filter(([,v])=>v==='active');
      const done=Object.entries(qs).filter(([,v])=>v==='done');
      say(ws,'─── Quest Log ──────────────────────────────────────','sys');
      if(!active.length&&!done.length){say(ws,'  No quests yet. Talk to NPCs in town.','sys');break;}
      if(active.length){say(ws,'  Active:','sys');active.forEach(([qid])=>{const q=QUESTS[qid];if(q)say(ws,`  ▶ ${q.title} — ${q.obj}`,'ok');});}
      if(done.length){say(ws,'  Completed:','sys');done.forEach(([qid])=>{const q=QUESTS[qid];if(q)say(ws,`  ✓ ${q.title}`,'sys');});}break;
    }
    case'farewell':case'bye':{const n=Object.values(NPCS).find(x=>x.room===p.room);if(n)say(ws,`${n.name} nods farewell.`,'narrate');break;}
    case'achievements':case'achieve':{
      say(ws,'─── Achievements ──────────────────────────────────','sys');
      const earned=p.achievements||[];
      ACHS.forEach(a=>{const done=earned.includes(a.id);say(ws,`  ${done?'✓':'○'} ${a.name.padEnd(20)} ${a.desc}${done&&a.reward>0?` [+${a.reward}g]`:''}`,'sys');});
      say(ws,`  Earned: ${earned.length}/${ACHS.length}`,'sys');break;
    }
    case'guild':case'g':{const pts=rest.split(' ');guildCmd(ws,p,pts[0].toLowerCase(),pts.slice(1).join(' '));break;}
    case'gc':guildCmd(ws,p,'chat',rest);break;
    case'guildhall':doGuildHall(ws,p);break;
    case'party':case'pt':{const pts=rest.split(' ');partyCmd(ws,p,pts[0].toLowerCase(),pts.slice(1).join(' '));break;}
    case'pc':partyCmd(ws,p,'chat',rest);break;
    case'trade':tradeCmd(ws,p,rest);break;
    case'profile':showProfile(ws,p,p);break;
    case'bio':{if(!rest)return say(ws,'BIO [text]','err');p.bio=rest.slice(0,300);svc(p);say(ws,'Biography updated.','ok');break;}
    case'board':case'notices':showBoard(ws);break;
    case'leaders':case'leaderboard':case'lb':showLeaderboard(ws,rest);break;
    case'auction':case'ah':{const pts=rest.split(' ');auctionCmd(ws,p,pts[0].toLowerCase(),pts.slice(1).join(' '));break;}
    case'housing':case'room':case'inn':{const pts=rest.split(' ');housingCmd(ws,p,pts[0]||'enter',pts.slice(1).join(' '));break;}
    case'autoloot':{
      p.autoloot=!p.autoloot;
      say(ws,`Auto-loot ${p.autoloot?'ON — items picked up automatically':'OFF — items dropped on ground'}.`,p.autoloot?'ok':'sys');
      svc(p);break;
    }
    case'alias':{
      if(!rest){
        say(ws,'Your aliases:','sys');
        const aliases=p.aliases||{};
        if(!Object.keys(aliases).length)say(ws,'  None set. ALIAS [shortcut] [command] to create one.','sys');
        else Object.entries(aliases).forEach(([k,v])=>say(ws,`  ${k} = ${v}`,'sys'));
        break;
      }
      const [aliasKey,...aliasVal]=rest.split(' ');
      if(!aliasVal.length){
        if(p.aliases&&p.aliases[aliasKey]){delete p.aliases[aliasKey];say(ws,`Alias "${aliasKey}" removed.`,'ok');}
        else say(ws,`No alias "${aliasKey}". ALIAS [shortcut] [command] to create.`,'err');
      }else{
        if(!p.aliases)p.aliases={};
        p.aliases[aliasKey.toLowerCase()]=aliasVal.join(' ');
        say(ws,`Alias set: ${aliasKey} = ${aliasVal.join(' ')}`,'ok');
      }
      svc(p);break;
    }
    case'choose':{doChooseSpec(ws,p,rest);break;}
    case'time':case'weather':{
      const tw=getTimeWeather();
      say(ws,`Time: ${tw.hour} — Weather: ${tw.weather} — ${tw.isNight?'Night (creatures stronger)':'Day'}`,  'narrate');break;
    }
    case'chat':{
      // Channel chat: CHAT GLOBAL/TRADE [message]
      const parts=rest.split(' ');const ch=parts[0].toLowerCase();const msg=parts.slice(1).join(' ');
      if(ch==='trade'&&msg){bAll({type:'line',text:`[TRADE] ${p.name}: ${msg}`,cls:'shop'});break;}
      if(ch==='global'&&msg){bAll({type:'line',text:`[GLOBAL] ${p.name}: ${msg}`,cls:'chat'});break;}
      say(ws,'CHAT GLOBAL [msg] or CHAT TRADE [msg]','sys');break;
    }
    case'post':{
      if(!rest)return say(ws,'POST [message] to pin a notice on the board.','err');
      if(rest.length>200)return say(ws,'Notice too long (max 200 chars).','err');
      addNotice(p.name,rest);break;
    }
    case'say':{if(!rest)return;say(ws,`You say: "${rest}"`,'chat');sayRoom(p.room,`${p.name} says: "${rest}"`,'chat',ws);break;}
    case'yell':case'shout':{if(!rest)return;bAll({type:'line',text:`${p.name} yells: "${rest}"`,cls:'chat'});break;}
    case'tell':case'whisper':{
      const pts=rest.split(' '),tn=pts[0],msg=pts.slice(1).join(' ');
      if(!tn||!msg)return say(ws,'tell [player] [message]','err');
      const tgt=[...sessions.values()].find(x=>x.name&&x.name.toLowerCase()===tn.toLowerCase()&&x.loggedIn);
      if(!tgt)return say(ws,`${tn} is not online.`,'err');
      say(ws,`You whisper to ${tgt.name}: "${msg}"`,'tell');say(tgt.ws,`${p.name} whispers: "${msg}"`,'tell');break;
    }
    case'save':svc(p);say(ws,'[ Saved. ]','sys');break;
    case'help':showHelp(ws,p);break;
    default:say(ws,`Unknown command '${v}'. Type HELP.`,'err');
  }
}

// Monster descriptions
const MOB_DESCS = {
  "Giant Rat":"A large diseased rat the size of a cat. Red eyes, matted fur, yellowed teeth. Aggressive despite its size.",
  "Timber Wolf":"A lean grey wolf with pale intelligent eyes. Moves in silence. Likely has packmates nearby.",
  "Forest Troll":"A hulking creature covered in moss and bark-like skin. Knuckles drag the ground. Surprisingly fast.",
  "Stone Golem":"An ancient construct of mossy limestone, animated by forgotten magic. Glowing orange eyes. Slow but devastating.",
  "Swamp Serpent":"A massive bog serpent, mottled brown and green, venom dripping from curved fangs. Coiled and ready.",
  "Bog Witch":"A twisted old woman of the swamp. Wild hair tangled with weeds, gnarled staff, a grin that does not mean well.",
  "Skeleton Warrior":"An animated skeleton in rusted armour, sword raised. Empty eye sockets glow with cold blue fire.",
  "Armored Skeleton":"A heavier skeleton in better-preserved plate. More imposing than its lesser kin. Moves with purpose.",
  "Risen Corpse":"A shambling undead in rotted dungeon clothing. It does not think. It only approaches.",
  "Risen Cultist":"A robed undead, cult markings still visible on decayed flesh. Fingers curled around nothing.",
  "Crypt Lich":"A minor lich in burial robes, gold crown on a skull face. Dark energy crackles between its fingers.",
  "Prison Guard Ghost":"The translucent spirit of a dungeon guard, still in partial armour, chains dragging eternally behind it.",
  "Corrupt Priest":"A former priest, now undead. Torn holy robes. The symbols of faith it once wore now burn dark on its skin.",
  "Shadow Wraith":"A barely-visible dark form. Shifting at the edges. Only the glowing eyes give it any definition.",
  "Young Dragon":"Not fully grown, but still filling the chamber. Stone-grey scales, burning amber eyes, smoke curling from its nostrils.",
  "Void Cultist":"A living cultist in dark robes covered in void symbols. Violet energy crackling between both hands.",
  "Void Archon":"Taller and more powerful than a common cultist. Partially transformed, void energy consuming part of its body.",
  "Lich's Champion":"Massive armoured undead warrior in black plate. Red rune-light pulses along its armour. The Lich trusts it absolutely.",
  "Dungeon Lich":"The Dungeon Lich sits on a throne of bones. Iron crown. Cold blue fire in hollow eye sockets. Ancient and terrible. This is what you came for.",
  "Fire Elemental":"A living column of flame shaped like a humanoid. No face, just heat and light and hunger.",
  "Lava Golem":"A hulking construct of cooled and molten rock. Orange cracks of fresh lava run across its surface.",
  "Fire Imp":"Small, red, winged, and absolutely delighted to see you. Its grin is wider than its face should allow.",
  "Rock Wyrm":"A serpentine creature of stone and magma. No legs. Burrows through solid rock as if it were water.",
  "Flame Titan":"A fusion of molten rock and pure fury, compressed into a giant form. The ground cracks beneath each step.",
  "Frost Wolf":"Larger than a Timber Wolf. White-blue fur. Breath crystallizes in the air. Ice crystals in its coat.",
  "Ice Wraith":"A ghost-like figure of ice and frozen wind. Barely visible against the snow. Very fast.",
  "Yeti":"Massive white-furred ape-like creature. Enormous, shaggy. Its eyes suggest more intelligence than you would prefer.",
  "Ice Shard Golem":"A construct made of jagged ice shards with razor edges. Each movement sends splinters flying.",
  "Frost Knight":"A human warrior in ice-encrusted armour. Serves the Frost Queen. Blade permanently frozen solid.",
  "Frost Queen":"Regal and encased in living ice. Crown of icicles. Pale blue eyes, completely emotionless. Beautiful and lethal.",
  "Wind Spirit":"Made of moving air, barely visible. It trails disturbed clouds wherever it drifts.",
  "Thunder Hawk":"An eagle with a wingspan that fills the sky. Lightning crackles through every feather.",
  "Stone Sentinel":"An ancient gargoyle-like guardian that has been floating here for centuries. It is awake now.",
  "Storm God":"Not entirely physical. Storm clouds form its body. Lightning is its blood. It has noticed you.",
  "Shadow Demon":"Pure shadow given form. Clawed hands, glowing red eyes, constantly shifting.",
  "Nightmare Hound":"A black dog with no eyes. Mouth too wide. It runs on shadow instead of ground.",
  "Banshee":"A wailing female spirit with wild hair and flowing robes. Her mouth is open in a scream that has lasted centuries.",
  "Dark Treant":"A black leafless tree that walks. Ancient, twisted, shadow pouring from cracks in its bark.",
  "Void Emperor":"A robed figure on a throne of darkness. Face hidden. Void energy consuming everything around it.",
  "Crystal Golem":"A humanoid of pure crystal. Refracts light in dazzling patterns. Razor-sharp edges everywhere.",
  "Gem Spider":"A large spider with a gemstone abdomen that catches all light. Its legs are like needles.",
  "Diamond Guardian":"A nearly transparent crystal construct. Almost invisible until it moves.",
  "Prism Titan":"A colossal crystal being that refracts all light into blinding rainbows. Looking at it is difficult.",
  "Wailing Specter":"A howling ghost in tattered noble clothing. Its face is twisted in eternal anguish.",
  "Cursed Knight":"An armoured undead in blackened plate. Its blade drains life with every cut.",
  "Chained Revenant":"An undead prisoner still wearing its chains. Dragging them as it moves toward you.",
  "Bone Horror":"Assembled from the bones of multiple creatures. Wrong proportions. Too many limbs.",
  "Death Baron":"A skeletal lord in decayed finery. Crown, throne, commanding posture. It ruled here in life and refuses to accept otherwise.",
  "Astral Shark":"A shark-like creature swimming through silver astral light instead of water.",
  "Plane Walker":"A humanoid traveller between planes, partially phased in and out of reality.",
  "Githyanki Pirate":"Tall and gaunt with silver armour and a blade that glows with planar energy.",
  "Astral Leviathan":"Impossibly large. A sea-serpent made of astral energy. It circles the vortex and has done so since before your world existed.",
  "Void Wraith":"Shadow from beyond existence. Even less defined than a Shadow Demon. Almost nothing at all.",
  "Null Horror":"An entity of pure void. Looking at it feels wrong. Reality bends around it.",
  "Void Scholar":"Robed, still reading. Half-consumed by the void it studied. Still reading.",
  "Void God":"Presence more than form. The void given terrible consciousness. You should not be here.",
  "Bandit Scout":"A lean outlaw in mismatched leather armour. Dagger in one hand, crossbow ready.",
  "Bandit Thug":"A larger meaner bandit. Scarred face, crude weapons, absolutely itching for an excuse.",
  "Bandit King":"Self-styled king in stolen finery layered over bandit armour. Overconfident grin. Dangerous.",
  "Shadow Stalker":"A predator that hunts only at night. Low to the ground, multiple dark limbs. Completely silent.",
  "Night Horror":"Something that should not exist in daylight. Formless in darkness. You catch glimpses."
}

function showMobProfile(ws, mob){
  const portrait = MOB_PORTRAITS[mob.name];
  const desc = MOB_DESCS[mob.name] || 'A dangerous creature lurking in the shadows.';
  raw(ws,{
    type:'mob_profile',
    name:mob.name,
    hp:mob.hp, maxhp:mob.maxhp,
    atk:mob.atk, def:mob.def,
    xp:mob.xp, gold:mob.gold,
    desc:desc,
    img: portrait ? '/monsters/'+portrait : null
  });
}

function showNPCProfile(ws,npc){
  const npcKey=Object.keys(NPCS).find(k=>NPCS[k]===npc)||'';
  const hasChainQ=Object.values(QUEST_CHAINS||{}).some(q=>q.giver===npcKey);
  const hasBaseQ=Object.values(QUESTS).some(q=>q.giver===npcKey);
  raw(ws,{
    type:'npc_profile',
    name:npc.name,
    title:npc.title||'',
    desc:npc.desc||'',
    portrait:npc.portrait||'',
    portraitImg:npc.portraitFile?('/npcs/'+npc.portraitFile):null,
    greeting:npc.greeting||'',
    room:world[npc.room]?.name||npc.room,
    hasQuests:hasBaseQ||hasChainQ
  });
}

function showProfile(ws,viewer,target){
  const tGuild=target.guildId?guilds[target.guildId]:null;
  raw(ws,{type:'profile',name:target.name,raceName:target.raceName||'Unknown',className:target.className||'Unknown',
    level:target.level,hp:target.hp,maxhp:target.maxhp,atk:target.atk,def:target.def,
    gold:viewer.username===target.username?target.gold:null,xp:target.xp,xpNext:target.level*100,
    bio:target.bio||'',avatar:target.avatar||'',equipped:target.equipped||[],
    companion:target.companion?target.companion.name:null,zombieCount:(target.zombies||[]).length,
    guildName:tGuild?tGuild.name:null,
    isSelf:viewer.username===target.username});
}

function showMap(ws){
  say(ws,'======= SHADOWMERE WORLD MAP =================','sep');
  say(ws,'TOWN: Guild District[N of Temple]-Temple-Town Square[SHRINE up]-Tavern-Apothecary','zone');
  say(ws,'      Market St[PET STORE<]-Weaponsmith | Alley-Shadow Broker','sys');
  say(ws,'      South Gate -> Ashwood Forest / down Dungeon Entrance','sys');
  say(ws,'FOREST: Ashwood Edge->Deep[->EAST Ashford Village]->Swamp Border->Heart | Edge->Camp | Deep->Ruins','zone');
  say(ws,'ASHFORD: Square->Store(W) Store(E) Healer(N) Gate(S) Outskirts->Bandit Camp','zone');
  say(ws,'DUNGEON: Entrance->Hall->Crypts->Vault | Hall->Prison | Hall->Well','zone');
  say(ws,'         Hall->Armory->Mid | Temple->Temple Crypt->Mid','sys');
  say(ws,'         Mid->Dragon Lair | Mid->Void Temple | Mid->Antechamber->LICH BOSS','sys');
  say(ws,'ADVENTURE ZONES (UP at Town Square -> Shrine -> TELEPORT [1-8]):','zone');
  Object.entries(TELEPORT_ZONES).forEach(([k,z])=>say(ws,`  [${k}] ${z.name.padEnd(22)} Lv${z.lvl}+ — Boss: ${z.boss}`,'sys'));
  say(ws,'==============================================','sep');
}

function showHelp(ws,p){
  say(ws,'--- Commands ------------------------------------','sys');
  say(ws,'n/s/e/w/up/down/out   Move','sys');
  say(ws,'look [player/item]    Look around, examine item, or view profile','sys');
  say(ws,'take/drop [item]      Pick up or drop','sys');
  say(ws,'use/equip/unequip     Use consumable or manage gear','sys');
  say(ws,'attack / flee         Combat','sys');
  say(ws,'skill [name] / skills Use or list class skills','sys');
  say(ws,'shop / buy / sell     Shopping','sys');
  say(ws,'recipes / craft       View and craft items at smith/apothecary','sys');
  say(ws,'shrine / teleport     Adventure zone travel','sys');
  say(ws,'tame / dismiss        Tame or release animal companion','sys');
  say(ws,'companion / zombies   Check companion or zombie status','sys');
  say(ws,'talk [npc]            Talk to an NPC in your room','sys');
  say(ws,'ask [question]        Ask an NPC anything (AI-powered)','sys');
  say(ws,'accept                Accept a quest from an NPC','sys');
  say(ws,'quests / achievements  View quest log or achievements','sys');
  say(ws,'party invite/join/leave/follow/info/chat (pc)','sys');
  say(ws,'guild create/join/leave/info/list/chat (gc)/deposit/withdraw/motd','sys');
  say(ws,'guildhall             Enter your guild hall','sys');
  say(ws,'trade [player]        Open a trade session','sys');
  say(ws,'trade offer [item/g]  Add to trade offer','sys');
  say(ws,'trade confirm/cancel  Complete or cancel trade','sys');
  say(ws,'inventory / stats     Character info','sys');
  say(ws,'profile / bio [text]  View or set character profile','sys');
  say(ws,'who / map / save      Online players / map / save','sys');
  say(ws,'say / yell / tell     Chat commands','sys');
  say(ws,'chat global/trade [msg] Broadcast to all players','sys');
  say(ws,'--- Economy ------------------------------------','sys');
  say(ws,'auction list             Browse auction listings','sys');
  say(ws,'auction sell [item] [g]  List item for sale','sys');
  say(ws,'auction buy [#]          Purchase a listing','sys');
  say(ws,'auction cancel [#]       Remove your listing','sys');
  say(ws,'--- World --------------------------------------','sys');
  say(ws,'time / weather           Current time and weather','sys');
  say(ws,'leaders [level/kills/gold] View leaderboards','sys');
  say(ws,'housing rent/enter       Rent a room at an inn (50g)','sys');
  say(ws,'housing store/retrieve   Manage room storage','sys');
  say(ws,'--- Quality of Life ----------------------------','sys');
  say(ws,'autoloot                 Toggle auto item pickup','sys');
  say(ws,'alias [key] [command]    Set command shortcuts','sys');
  say(ws,'alias                    View your aliases','sys');
  say(ws,'choose [#]               Choose specialization skill','sys');
  if(p){const cls=CLASSES[p.classId];if(cls)say(ws,`Skills: ${(cls.skills||[]).map(s=>SK[s]?.n||s).join(', ')}`,'skill');}
}


// ── Auth flow ─────────────────────────────────────────────────────────────
function handleAuth(ws,sess,inputMsg){
  try{
  const msg=inputMsg.trim();
  switch(sess.state){
    case'WELCOME':
      if(msg.toLowerCase()==='login'){sess.state='LOGIN_USER';say(ws,'Username:','sys');}
      else if(msg.toLowerCase()==='register'){sess.state='REG_USER';say(ws,'Choose a username (3-20 letters/numbers):','sys');}
      else say(ws,'Type LOGIN or REGISTER.','sys');
      break;
    case'LOGIN_USER':
      sess.user=msg.toLowerCase().replace(/[^a-z0-9]/g,'');
      if(!sess.user)return say(ws,'Invalid username.','err');
      sess.state='LOGIN_PASS';say(ws,'Password:','sys');break;
    case'LOGIN_PASS':{
      if(!cex(sess.user)){sess.state='WELCOME';return say(ws,'No account found. Type REGISTER.','err');}
      const data=ldc(sess.user);
      if(!data||data.passwordHash!==hash(msg)){sess.state='WELCOME';return say(ws,'Wrong password.','err');}
      if([...sessions.values()].find(s=>s.username===sess.user&&s.loggedIn)){sess.state='WELCOME';return say(ws,'Already logged in elsewhere.','err');}
      const p=hydrate(data);p.ws=ws;p.loggedIn=true;
      // Validate saved room — if it doesn't exist, send to town square
      if(!world[p.room]){
        console.log('[LOGIN] Invalid room "'+p.room+'" for '+p.username+', resetting to town_square');
        p.room='town_square';
      }
      sessions.set(ws,p);
      say(ws,`Welcome back, ${p.name} the ${p.raceName||''} ${p.className}!`,'ok');
      bAll({type:'line',text:`${p.name} the ${p.raceName||''} ${p.className} has entered Shadowmere.`,cls:'narrate'});
      // Restore saved avatar to client
      if(p.avatar){raw(ws,{type:'avatar_saved',avatar:p.avatar});}
      try{describeRoom(ws,p);}catch(e){console.error('[DESCRIBE ERROR]',e.message);}
      try{sidebar(ws,p);}catch(e){console.error('[SIDEBAR ERROR]',e.message);}
      break;
    }
    case'REG_USER':
      sess.user=msg.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20);
      if(sess.user.length<3)return say(ws,'Min 3 characters.','err');
      if(cex(sess.user))return say(ws,'Username taken. Try another.','err');
      sess.state='REG_PASS';say(ws,'Choose a password (min 4 chars):','sys');break;
    case'REG_PASS':
      if(msg.length<4)return say(ws,'Min 4 characters.','err');
      sess.pass=msg;sess.state='REG_NAME';say(ws,'Your character name (visible to others):','sys');break;
    case'REG_NAME':
      console.log('[REG] Name received:',msg);
      sess.charName=msg.replace(/[^a-zA-Z ]/g,'').trim().slice(0,20);
      if(sess.charName.length<2)return say(ws,'Name too short.','err');
      sess.state='REG_RACE';
      console.log('[REG] Sending pick_race, races count:',Object.keys(RACES).length);
      try{
        const raceData=Object.entries(RACES).map(([id,r])=>({id,name:r.name,bonus:r.bonus,hp:r.hp,atk:r.atk,def:r.def,gold:r.gold}));
        console.log('[REG] Race data built OK, sending...');
        raw(ws,{type:'pick_race',races:raceData});
        console.log('[REG] pick_race sent OK');
      }catch(re){console.error('[REG] pick_race FAILED:',re.message,re.stack);}
      break;
    case'REG_RACE':{
      console.log('[REG] Race received:',msg);
      const rid=msg.toLowerCase().trim();
      if(!RACES[rid])return say(ws,`Invalid race. Options: ${Object.keys(RACES).join(', ')}`, 'err');
      sess.raceId=rid;sess.state='REG_CLASS';
      raw(ws,{type:'pick_class',classes:Object.entries(CLASSES).map(([id,c])=>({id,name:c.name,role:c.role,hp:c.hp,atk:c.atk,def:c.def,skills:(c.skills||[]).slice(0,3).map(s=>SK[s]?.n||s)}))});
      break;
    }
    case'REG_CLASS':{
      console.log('[REG] Class received:',msg);
      const cid=msg.toLowerCase().trim().replace(/\s+/g,'');
      const key=Object.keys(CLASSES).find(k=>k===cid||CLASSES[k].name.toLowerCase().replace(/\s+/g,'')===cid);
      if(!key)return say(ws,`Invalid class. Options: ${Object.keys(CLASSES).join(', ')}`,'err');
      const p=newPlayer(sess.user,sess.pass,sess.charName,sess.raceId,key);
      p.ws=ws;p.loggedIn=true;
      // Ensure data dirs exist before saving
      try{
        if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});
        if(!fs.existsSync(CHAR_DIR))fs.mkdirSync(CHAR_DIR,{recursive:true});
        svc(p);
      }catch(saveErr){
        console.error('[SAVE FAIL]',saveErr.message);
        // Continue anyway - player can play, just won't persist
      }
      sessions.set(ws,p);
      say(ws,`Welcome to Shadowmere, ${p.name} the ${p.raceName} ${p.className}!`,'ok');
      say(ws,`Race bonus: ${RACES[sess.raceId].bonus}`,'narrate');
      say(ws,'The Dungeon Lich has risen. The land needs a hero.','narrate');
      bAll({type:'line',text:`${p.name} the ${p.raceName} ${p.className} joins Shadowmere for the first time!`,cls:'loot'});
      describeRoom(ws,p);sidebar(ws,p);break;
    }
  }
  }catch(e){
    console.error('[AUTH ERROR]',e.message,e.stack);
    try{say(ws,'Registration error. Please refresh and try again.','err');}catch(e2){}
  }
}

// ── HTTP + WebSocket server ───────────────────────────────────────────────
const server=http.createServer((req,res)=>{
  // Health check for Render
  if(req.url==='/health'){res.writeHead(200);res.end('OK');return;}
  // Serve monster/npc images
  if(req.url.startsWith('/monsters/')||req.url.startsWith('/npcs/')){
    const imgPath=path.join(__dirname,'public',req.url.split('?')[0]);
    fs.readFile(imgPath,(err,data)=>{
      if(err){res.writeHead(404);res.end('Not found');}
      else{res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=86400'});res.end(data);}
    });
    return;
  }
  // Serve client.html for all non-asset requests
  const isAsset = req.url.match(/\.(js|css|png|ico)$/);
  const fp = isAsset
    ? path.join(__dirname,'public',path.basename(req.url))
    : path.join(__dirname,'public','client.html');
  const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript'}[path.extname(fp)]||'text/html';
  fs.readFile(fp,(err,data)=>{
    if(err){
      // If client.html missing, check one level up
      const alt=path.join(__dirname,'client.html');
      fs.readFile(alt,(e2,d2)=>{
        if(e2){res.writeHead(404);res.end('Not found: '+fp);}
        else{res.writeHead(200,{'Content-Type':'text/html'});res.end(d2);}
      });
    }else{res.writeHead(200,{'Content-Type':mime});res.end(data);}
  });
});

const wss=new WS.Server({server});
wss.on('connection',ws=>{
  const sess={state:'WELCOME',user:'',pass:'',charName:'',raceId:''};
  sessions.set(ws,sess);
  const online=[...sessions.values()].filter(s=>s.loggedIn).length;
  say(ws,'╔════════════════════════════════════════════════════╗','sep');
  say(ws,'║      S H A D O W M E R E   M U D                 ║','sep');
  say(ws,'║  20 Classes · 15 Races · Guilds · Quests · NPCs  ║','sep');
  say(ws,'╚════════════════════════════════════════════════════╝','sep');
  say(ws,`${online} player(s) online.  Type LOGIN or REGISTER.`,'sys');
  ws.on('message',data=>{
    try{
      let raw2;try{raw2=data.toString().trim();}catch{return;}
      const p=sessions.get(ws);if(!p)return;
      if(!p.loggedIn){handleAuth(ws,p,raw2);return;}
      // Handle JSON messages (avatar etc) without routing to handleCmd
      if(raw2.startsWith('{')){
        try{
          const action=JSON.parse(raw2);
          if(action.type==='set_avatar'){
            if(action.data&&action.data.length<2200000){p.avatar=action.data;svc(p);raw(ws,{type:'avatar_saved',avatar:action.data});}
            else say(ws,'Image too large.','err');
          }else if(action.type==='clear_avatar'){p.avatar='';svc(p);raw(ws,{type:'avatar_saved',avatar:''});}
        }catch(je){console.error('[JSON MSG]',je.message);}
        return;
      }
      handleCmd(ws,p,raw2);
      // Only save if fully logged in player with username
      if(p.loggedIn&&p.username)svc(p);
    }catch(e){
      console.error('[MSG ERROR]',e.message,e.stack);
      try{say(ws,'An error occurred. Please try again.','err');}catch{}
    }
  });
  ws.on('close',()=>{
    const p=sessions.get(ws);
    if(p&&p.loggedIn){svc(p);bAll({type:'line',text:`${p.name} has left Shadowmere.`,cls:'narrate'});console.log('[DC]',p.name);}
    sessions.delete(ws);
  });
  ws.on('error',e=>console.error('[WS]',e.message));
});

// Initialize day/night after everything is loaded
updateDayNight();
applyNightMonsters();
console.log('[Boot] Day/night initialized — time:',TIMES[gameHour],'weather:',weather);

server.listen(PORT,'0.0.0.0',()=>{
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   SHADOWMERE MUD v10 — RUNNING                   ║');
  console.log(`  ║   http://localhost:${PORT}                             ║`);
  console.log('  ║   20 Classes · 15 Races · 8 Adventure Zones      ║');
  console.log('  ║   Guilds · Quests · AI NPCs · Admin Panel        ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});

