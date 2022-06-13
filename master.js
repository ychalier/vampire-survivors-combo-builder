import GLPK from './glpk.js';

const DATA_URL = "data.json";
var glpk;
var PREVIOUS_CONFIGURATION = null;
var SOUNDBOARD = null;

function removeEntityFromArray(array, entity) {
    for (let i = 0; i < array.length; i++) {
        if (array[i].slug == entity.slug) {
            array.splice(i, 1);
            break;
        }
    }
}

function createEntityImage(entity) {
    let container = document.createElement("div");
    container.className = "popover popover-bottom entity";
    let image = document.createElement("img");
    image.src = `./sprites/${entity.type}/${entity.slug}.png`;
    image.draggable = true;
    container.title = entity.label;
    image.setAttribute("type", entity.type);
    image.setAttribute("slug", entity.slug);
    container.setAttribute("slug", entity.slug);
    image.addEventListener("dragstart", (event => {
        event.dataTransfer.setData("text/plain", entity.slug);
    }));
    container.appendChild(image);
    if (entity.type == "arcana") {
        let popover = document.createElement("div");
        popover.className = "popover-container text-center";
        let popover_image = document.createElement("img");
        popover_image.src = `./sprites/${entity.type}/${entity.slug}.png`;
        popover_image.style.transform = "scale(2) translateY(25%)";
        popover.appendChild(popover_image);
        container.appendChild(popover);
    }
    return container;
}

function inflateBuildRow(row, entities) {
    entities.forEach((entity, i) => {
        let cell = row.querySelector(`.entity-cell:nth-child(${i + 1})`);
        cell.innerHTML = "";
        let image = createEntityImage(entity);
        cell.appendChild(image);
    });
}

class Collection {

    constructor(data) {
        this.arcanas = data.arcanas;
        this.items = data.items;
        this.weapons = data.weapons;
        this.stages = data.stages;
        this.entities = {};
        this.banned = [];
        this.arcanas.forEach(entity => {
            entity.type = "arcana";
            this.entities[entity.slug] = entity;
        });
        this.items.forEach(entity => {
            entity.type = "item";
            this.entities[entity.slug] = entity;
        });
        this.weapons.basic.forEach(entity => {
            entity.type = "weapon";
            this.entities[entity.slug] = entity;
        });
        this.weapons.evolved.forEach(entity => {
            entity.type = "weapon";
            this.entities[entity.slug] = entity;
        });
    }

    inflateRow(container, entities) {
        container.innerHTML = "";
        entities.forEach(entity => {
            let image = createEntityImage(entity);
            let cell = document.createElement("div");
            cell.className = "entity-cell";
            cell.appendChild(image);
            container.appendChild(cell);
            cell.addEventListener("click", () => {
                if (cell.classList.contains("disabled")) {
                    cell.classList.remove("disabled");
                } else {
                    cell.classList.add("disabled");
                }
            });
        });
    }

    inflate() {
        this.inflateRow(document.querySelector(".entity-row[collection-type='basic_weapons']"), this.weapons.basic, false);
        this.inflateRow(document.querySelector(".entity-row[collection-type='evolved_weapons']"), this.weapons.evolved, false);
        this.inflateRow(document.querySelector(".entity-row[collection-type='items']"), this.items, false);
        this.inflateRow(document.querySelector(".entity-row[collection-type='arcanas']"), this.arcanas, true);
        let stageSelect = document.querySelector("select[name='stage']");
        this.stages.forEach(stage => {
            let option = document.createElement("option");
            option.value = stage.slug;
            option.textContent = stage.label;
            stageSelect.appendChild(option);
        });
    }
}

class Configuration {

    constructor(collection) {
        this.collection = collection;
        this.build = {
            weapons: [],
            items: [],
            stage_items: [],
            arcanas: []
        }
        this.ban = [];
        this.weights = {
            combos: 1,
            evolutions: 1
        }
        this.reset();
    }

    copy() {
        let aux = new Configuration(this.collection);
        this.build.weapons.forEach(weapon => aux.build.weapons.push(weapon));
        this.build.items.forEach(item => aux.build.items.push(item));
        this.build.stage_items.forEach(item => aux.build.stage_items.push(item));
        this.build.arcanas.forEach(arcana => aux.build.arcanas.push(arcana));
        this.ban.forEach(entity => aux.ban.push(entity));
        aux.weights.combos = this.weights.combos;
        aux.weights.evolutions = this.weights.evolutions;
        return aux;
    }

    import(other) {
        this.build = other.build;
        this.ban = other.ban;
        this.weights = other.weights;
    }

    read() {
        let input = document.getElementById("config-coef");
        if (input.value == 1) {
            this.weights.combos = 100;
            this.weights.evolutions = 1;
        } else if (input.value == 2) {
            this.weights.combos = 1;
            this.weights.evolutions = 1;
        } else if (input.value == 3) {
            this.weights.combos = 1;
            this.weights.evolutions = 100;
        }
        this.ban = [];
        document.querySelectorAll("#collection .entity-cell").forEach(entityCell => {
            if (entityCell.classList.contains("disabled")) {
                let entity = this.collection.entities[entityCell.querySelector(".entity").getAttribute("slug")];
                this.ban.push(entity);
            }
        });
    }

    inflate() {
        document.querySelectorAll("#build .entity-cell").forEach(cell => {
            cell.innerHTML = "";
        });
        inflateBuildRow(document.querySelector("#build .entity-row[build-type='weapons']"), this.build.weapons);
        inflateBuildRow(document.querySelector("#build .entity-row[build-type='items']"), this.build.items);
        inflateBuildRow(document.querySelector("#build .entity-row[build-type='stage_items']"), this.build.stage_items);
        inflateBuildRow(document.querySelector("#build .entity-row[build-type='arcanas']"), this.build.arcanas);
        // TODO: remaining config
        document.getElementById("combo-score").textContent = this.get_combos().length;
        this.inflate_combos();
    }

    inflate_combos() {
        let table = document.getElementById("table-combos");
        table.innerHTML = "";
        let thead = document.createElement("thead");
        table.appendChild(thead);
        let tbody = document.createElement("tbody");
        table.appendChild(tbody);
        let thead_tr = document.createElement("tr");
        thead.appendChild(thead_tr);
        thead_tr.appendChild(document.createElement("th"));
        let col_total = [];
        this.build.items.concat(this.build.stage_items).concat(this.build.arcanas).forEach(entity => {
            let image = createEntityImage(entity);
            let th = document.createElement("th");
            th.appendChild(image);
            thead_tr.appendChild(th);
            col_total.push(0);
        });
        this.build.weapons.forEach(weapon => {
            let tr = document.createElement("tr");
            tbody.appendChild(tr);
            let td_weapon = document.createElement("td");
            let image = createEntityImage(weapon);
            td_weapon.appendChild(image);
            tr.appendChild(td_weapon);
            let row_total = 0;
            this.build.items.concat(this.build.stage_items).concat(this.build.arcanas).forEach((entity, j) => {
                let td = document.createElement("td");
                tr.appendChild(td);
                let found_a_combo = false;
                for (let i = 0; i < weapon.combos.length; i++) {
                    let combo = weapon.combos[i];
                    if ((combo.arcana == null && combo.item == entity.slug) || (combo.item == null && combo.arcana == entity.slug)) {
                        td.innerHTML += `<i class="icon icon-check text-success"></i>`;
                        row_total++;
                        col_total[j]++;
                        found_a_combo = true;
                    } else if (combo.arcana != null && combo.item != null) {
                        if (entity.slug == combo.item && this.contains_arcana(combo.arcana)) {
                            td.innerHTML += `<i class="icon icon-check text-success"></i>`;
                            row_total++;
                            col_total[j]++;
                            found_a_combo = true;
                        }
                    }
                }
                if (!found_a_combo) {
                    td.innerHTML = `<i class="icon icon-cross text-error"></i>`;
                }
            });
            let td_total_row = document.createElement("td");
            td_total_row.textContent = row_total;
            tr.appendChild(td_total_row);
        });
        let tr_total_col = document.createElement("tr");
        tr_total_col.appendChild(document.createElement("td"));
        col_total.forEach(value => {
            let td = document.createElement("td");
            td.textContent = value;
            tr_total_col.appendChild(td);
        });
        let td_total = document.createElement("td");
        td_total.textContent = col_total.reduce((s, a) => s + a, 0);
        tr_total_col.appendChild(td_total);
        tbody.appendChild(tr_total_col);
    }

    get_combos() {
        let combos = [];
        this.build.weapons.forEach(weapon => {
            weapon.combos.forEach(combo => {
                let has_item = combo.item == null || this.contains_item(combo.item) || this.contains_stage_item(combo.item);
                let has_arcana = combo.arcana == null || this.contains_arcana(combo.arcana);
                if (has_item && has_arcana) {
                    combos.push({
                        "weapon": weapon,
                        item: combo.item,
                        arcana: combo.arcana
                    });
                }
            });
        });
        return combos;
    }

    _add_weapon(weapon) {
        let found = false;
        for (let i = 0; i < this.build.weapons.length; i++) {
            if (this.build.weapons[i].slug == weapon.slug) {
                found = true;
                break;
            }
        }
        if (!found && this.build.weapons.length < 6) {
            this.build.weapons.push(weapon);
        }
    }

    _add_item(item) {
        let found = false;
        for (let i = 0; i < this.build.items.length; i++) {
            if (this.build.items[i].slug == item.slug) {
                found = true;
                break;
            }
        }
        if (!found && this.build.items.length < 6) {
            this.remove(item); // Remove from stage items
            this.build.items.push(item);
        }
    }

    _add_stage_item(item) {
        let found = false;
        for (let i = 0; i < this.build.stage_items.length; i++) {
            if (this.build.stage_items[i].slug == item.slug) {
                found = true;
                break;
            }
        }
        if (!found) {
            this.remove(item); // Remove from regular items
            this.build.stage_items.push(item);
        }
    }

    _add_arcana(arcana) {
        let found = false;
        for (let i = 0; i < this.build.arcanas.length; i++) {
            if (this.build.arcanas[i].slug == arcana.slug) {
                found = true;
                break;
            }
        }
        if (!found && this.build.arcanas.length < 3) {
            this.build.arcanas.push(arcana);
        }
    }

    add(entity, build_type) {
        if (build_type == "weapons") {
            this._add_weapon(entity);
        } else if (build_type == "items") {
            this._add_item(entity);
        } else if (build_type == "stage_items") {
            this._add_stage_item(entity);
        } else if (build_type == "arcanas") {
            this._add_arcana(entity);
        } else {
            console.error("Unknown build type:", build_type);
        }
    }

    remove(entity) {
        removeEntityFromArray(this.build.weapons, entity);
        removeEntityFromArray(this.build.items, entity);
        removeEntityFromArray(this.build.stage_items, entity);
        removeEntityFromArray(this.build.arcanas, entity);
    }

    set_stage_items(...slugs) {
        this.build.stage_items = [];
        slugs.forEach(slug => {
            this.build.stage_items.push(this.collection.entities[slug]);
        });
    }

    reset() {
        this.build = {
            weapons: [],
            items: [],
            stage_items: [],
            arcanas: []
        }
    }

    _contains(slug, array) {
        for (let i = 0; i < array.length; i++) {
            if (array[i].slug == slug) {
                return true;
            }
        }
        return false;
    }

    contains_weapon(slug) {
        return this._contains(slug, this.build.weapons);
    }

    contains_item(slug) {
        return this._contains(slug, this.build.items);
    }

    contains_stage_item(slug) {
        return this._contains(slug, this.build.stage_items);
    }

    contains_arcana(slug) {
        return this._contains(slug, this.build.arcanas);
    }

}

function shuffled(array) {
    let newArray = [];
    array.forEach(x => newArray.push(x));
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = newArray[i];
        newArray[i] = newArray[j];
        newArray[j] = temp;
    }
    return newArray;
}

class Model {
    constructor(collection, configuration) {
        this.collection = collection;
        this.configuration = configuration;
        this.problem = null;
        this.setup();
    }

    setup() {
        this.problem = {
            name: "LP",
            objective: {
                direction: glpk.GLP_MAX,
                name: "obj",
                vars: []
            },
            generals: [],
            binaries: [],
            subjectTo: [],
        }
        let expr;

        // Setting up arcanas
        expr = [];
        shuffled(this.collection.arcanas).forEach(arcana => {
            this.problem.binaries.push(`collect_${arcana.slug}`);
            this.problem.objective.vars.push({
                name: `collect_${arcana.slug}`,
                coef: 1
            });
            expr.push({
                name: `collect_${arcana.slug}`,
                coef: 1
            });
        });
        this.problem.subjectTo.push({
            name: `limit_arcanas`,
            vars: expr,
            bnds: {
                type: glpk.GLP_UP,
                ub: 3
            }
        });

        // Setting up items
        expr = [];
        shuffled(this.collection.items).forEach(item => {
            this.problem.binaries.push(`collect_${item.slug}`);
            this.problem.objective.vars.push({
                name: `collect_${item.slug}`,
                coef: 1
            });
            if (item.unlockable && !this.configuration.contains_stage_item(item.slug)) {
                expr.push({
                    name: `collect_${item.slug}`,
                    coef: 1
                });
            } else if (!item.unlockable && !this.configuration.contains_stage_item(item.slug)) {
                this.problem.subjectTo.push({
                    name: `unavailable_${item.slug}`,
                    vars: [{
                        name: `collect_${item.slug}`,
                        coef: 1
                    }],
                    bnds: {
                        type: glpk.GLP_UP,
                        ub: 0
                    }
                });
            }
        });
        this.problem.subjectTo.push({
            name: `limit_items`,
            vars: expr,
            bnds: {
                type: glpk.GLP_UP,
                ub: 6
            }
        });

        // Setting up weapons
        expr = [];
        let hasEvolution = {};
        shuffled(this.collection.weapons.evolved).forEach(weapon => {
            this.problem.binaries.push(`collect_${weapon.slug}`);
            this.problem.objective.vars.push({
                name: `collect_${weapon.slug}`,
                coef: this.configuration.weights.evolutions
            });
            expr.push({
                name: `collect_${weapon.slug}`,
                coef: 1
            });
            weapon.evolution.weapons.forEach(baseWeaponSlug => {
                hasEvolution[baseWeaponSlug] = weapon;
            });
            weapon.evolution.items.forEach(itemSlug => {
                this.problem.subjectTo.push({
                    name: `evolution_requires_item_${itemSlug}`,
                    vars: [
                        {
                            name: `collect_${weapon.slug}`,
                            coef: 1
                        },
                        {
                            name: `collect_${itemSlug}`,
                            coef: -1
                        }
                    ],
                    bnds: {
                        type: glpk.GLP_UP,
                        ub: 0
                    }
                });
            });
        });
        shuffled(this.collection.weapons.basic).forEach(weapon => {
            this.problem.binaries.push(`collect_${weapon.slug}`);
            this.problem.objective.vars.push({
                name: `collect_${weapon.slug}`,
                coef: 1
            });
            expr.push({
                name: `collect_${weapon.slug}`,
                coef: 1
            });
        });
        this.collection.weapons.basic.concat(this.collection.weapons.evolved).forEach(weapon => {
            if (weapon.slug in hasEvolution) {
                let evolvedWeapon = hasEvolution[weapon.slug];
                this.problem.subjectTo.push({
                    name: `evolution_consumes_item_${weapon.slug}`,
                    vars: [
                        {
                            name: `collect_${weapon.slug}`,
                            coef: 1
                        },
                        {
                            name: `collect_${evolvedWeapon.slug}`,
                            coef: 1
                        }
                    ],
                    bnds: {
                        type: glpk.GLP_UP,
                        ub: 1
                    }
                });

                // Here we make sure that a basic weapon can not be collected
                // if all the items required for its evolution are collected.
                // TODO: there might be an issue if the weapon is banned
                let sub_expr = [{ name: `collect_${weapon.slug}`, coef: 1 }];
                evolvedWeapon.evolution.items.forEach(itemSlug => {
                    sub_expr.push({ name: `collect_${itemSlug}`, coef: 1 });
                });
                this.problem.subjectTo.push({
                    name: `evolution_priority_${weapon.slug}`,
                    vars: sub_expr,
                    bnds: {
                        type: glpk.GLP_UP,
                        ub: evolvedWeapon.evolution.items.length
                    }
                });
            }
        });
        this.problem.subjectTo.push({
            name: `limit_weapons`,
            vars: expr,
            bnds: {
                type: glpk.GLP_UP,
                ub: 6
            }
        });

        // Setting up combos
        this.collection.weapons.basic.concat(this.collection.weapons.evolved).forEach(weapon => {
            weapon.combos.forEach((combo, i) => {
                this.problem.binaries.push(`combo_${weapon.slug}_${i}`);
                this.problem.objective.vars.push({
                    name: `combo_${weapon.slug}_${i}`,
                    coef: this.configuration.weights.combos
                });
                this.problem.subjectTo.push({
                    name: `combo_${weapon.slug}_${i}_weapon`,
                    vars: [
                        {
                            name: `combo_${weapon.slug}_${i}`,
                            coef: 1
                        },
                        {
                            name: `collect_${weapon.slug}`,
                            coef: -1
                        }
                    ],
                    bnds: {
                        type: glpk.GLP_UP,
                        ub: 0
                    }
                });
                
                if (combo.item != null) {
                    this.problem.subjectTo.push({
                        name: `combo_${weapon.slug}_${i}_item`,
                        vars: [
                            {
                                name: `combo_${weapon.slug}_${i}`,
                                coef: 1
                            },
                            {
                                name: `collect_${combo.item}`,
                                coef: -1
                            }
                        ],
                        bnds: {
                            type: glpk.GLP_UP,
                            ub: 0
                        }
                    });
                }

                if (combo.arcana != null) {
                    this.problem.subjectTo.push({
                        name: `combo_${weapon.slug}_${i}_arcana`,
                        vars: [
                            {
                                name: `combo_${weapon.slug}_${i}`,
                                coef: 1
                            },
                            {
                                name: `collect_${combo.arcana}`,
                                coef: -1
                            }
                        ],
                        bnds: {
                            type: glpk.GLP_UP,
                            ub: 0
                        }
                    });
                }

            });
        });

        // Configuration bans
        this.configuration.ban.forEach(entity => {
            this.problem.subjectTo.push({
                name: `ban_${entity.slug}`,
                vars: [{
                    name: `collect_${entity.slug}`,
                    coef: 1
                }],
                bnds: {
                    type: glpk.GLP_FX,
                    ub: 0,
                    lb: 0
                }
            })
        });

        // Configurion build
        this.configuration.build.weapons
            .concat(this.configuration.build.items)
            .concat(this.configuration.build.stage_items)
            .concat(this.configuration.build.arcanas)
            .forEach(entity => {
                this.problem.subjectTo.push({
                    name: `build_${entity.slug}`,
                    vars: [{
                        name: `collect_${entity.slug}`,
                        coef: 1
                    }],
                    bnds: {
                        type: glpk.GLP_FX,
                        ub: 1,
                        lb: 1
                    }
                }
            );
        });
    }

}

class Soundboard {
    constructor() {
        this.sounds = {
            click_clear: "sfx/VS_Gem_v04-01-B.ogg",
            click_reset: "sfx/sfx_sounds_ban.ogg",
            click_load: "sfx/sfx_sounds_powerup2.ogg",
            drop_success: "sfx/sfx_sounds_pause7_in.ogg",
            drop_error: "sfx/sfx_sounds_pause7_out.ogg",
            gen_start: "sfx/sfx_moon_starter.ogg",
            gen_loop: "sfx/sfx_moon_beat.ogg",
            gen_end: "sfx/VS_LevelUp_v02-02.ogg",
        }
        this.players = {};
        for (let sound in this.sounds) {
            let player = document.createElement("audio");
            player.src = this.sounds[sound];
            player.type = "audio/ogg";
            document.body.appendChild(player);
            this.players[sound] = player;
        }

    }

    force_start(player) {
        player.currentTime = 0;
        player.play();
    }

    click_clear() {
        this.force_start(this.players.click_clear);
    }

    click_reset() {
        this.force_start(this.players.click_reset);
    }

    click_load() {
        this.force_start(this.players.click_load);
    }

    drop_success() {
        this.force_start(this.players.drop_success);
    }

    drop_error() {
        this.force_start(this.players.drop_error);
    }

    gen_start() {
        this.force_start(this.players.gen_start);
    }

    gen_end() {
        this.force_start(this.players.gen_end);
    }

}


function get_solution_build(collection, configuration, solution) {
    console.log("Solution", solution);
    let build = {
        weapons: [],
        items: [],
        stage_items: [],
        arcanas: []
    }
    collection.weapons.basic.concat(collection.weapons.evolved).forEach(weapon => {
        if (solution.result.vars[`collect_${weapon.slug}`] == 1) {
            build.weapons.push(weapon);
        }
    });
    collection.items.forEach(item => {
        if (solution.result.vars[`collect_${item.slug}`] == 1) {
            if (configuration.contains_stage_item(item.slug)) {
                build.stage_items.push(item);
            } else {
                build.items.push(item);
            }
        }
    });
    collection.arcanas.forEach(arcana => {
        if (solution.result.vars[`collect_${arcana.slug}`] == 1) {
            build.arcanas.push(arcana);
        }
    });
    return build;
}


async function solveProblem(collection, configuration) {
    glpk = await GLPK();
    const model = new Model(collection, configuration);
    console.log(model);
    const solution = await glpk.solve(model.problem, glpk.GLP_MSG_ERR);
    configuration.build = get_solution_build(collection, configuration, solution);
    SOUNDBOARD.gen_end();
    document.getElementById("modal-generate").classList.remove("active");
    if (solution.status != glpk.GLP_OPT) {
        if (solution.status == glpk.GLP_UNDEF) {
            alert("Solution is undefined");
        } else if (solution.result.status == glpk.GLP_FEAS) {
            alert("Solution is feasible");
        } else if (solution.result.status == glpk.GLP_INFEAS) {
            alert("Solution is infeasible");
        } else if (solution.result.status == glpk.GLP_NOFEAS) {
            alert("No feasible solution exists");
        } else if (solution.result.status == glpk.GLP_UNBND) {
            alert("Solution is unbounded");
        }
    }
    configuration.inflate();
}

function setupDragAndDrop(collection, configuration) {
    document.querySelectorAll(".entity-row").forEach(row => {
        row.querySelectorAll(".entity-cell").forEach(cell => {
            cell.addEventListener("drop", (event) => {
                event.preventDefault();
                event.stopPropagation();
                let entity = collection.entities[event.dataTransfer.getData("text/plain")];
                let row_entity_type = row.getAttribute("entity-type");
                if (!cell.hasChildNodes() && (row_entity_type == null || row_entity_type == entity.type)) {
                    configuration.add(entity, row.getAttribute("build-type"));
                    configuration.inflate();
                    SOUNDBOARD.drop_success();
                }
            });
            cell.addEventListener("dragover", (event) => {
                let entity = collection.entities[event.dataTransfer.getData("text/plain")];
                let row_entity_type = row.getAttribute("entity-type");
                if (!cell.hasChildNodes() && (row_entity_type == null || row_entity_type == entity.type)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                }
            });
        });
    });

    document.getElementById("drop-delete").addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });

    document.getElementById("drop-delete").addEventListener("drop", (event) => {
        let entity = collection.entities[event.dataTransfer.getData("text/plain")];
        event.preventDefault();
        event.stopPropagation();
        configuration.remove(entity);
        configuration.inflate();
        SOUNDBOARD.drop_error();
    });
}


function onLoadStageClick(configuration) {
    let select = document.querySelector("select[name='stage']");
    configuration.collection.stages.forEach(stage => {
        if (stage.slug == select.value) {
            configuration.set_stage_items(...stage.items);
        }
    });
    configuration.inflate();
}


function setupCommands(collection, configuration) {

    document.getElementById("btn-load-stage").addEventListener("click", () => {
        SOUNDBOARD.click_load();
        onLoadStageClick(configuration);
    });


    document.getElementById("button-reset").addEventListener("click", () => {
        configuration.reset();
        configuration.inflate();
        SOUNDBOARD.click_reset();
    });

    document.getElementById("button-clear").addEventListener("click", () => {
        if (PREVIOUS_CONFIGURATION != null) {
            configuration.import(PREVIOUS_CONFIGURATION);
            configuration.inflate();
        }
        SOUNDBOARD.click_clear();
    });

    document.getElementById("button-generate").addEventListener("click", () => {
        SOUNDBOARD.gen_start();
        document.getElementById("modal-generate").classList.add("active");
        configuration.read();
        PREVIOUS_CONFIGURATION = configuration.copy();
        solveProblem(collection, configuration);
    });


}


function loadData(data) {
    let collection = new Collection(data);
    collection.inflate();
    let configuration = new Configuration(collection);
    configuration.inflate();
    setupDragAndDrop(collection, configuration);
    setupCommands(collection, configuration);
}


window.addEventListener("load", () => {
    SOUNDBOARD = new Soundboard();
    fetch(DATA_URL).then(res => res.json()).then(loadData);
    document.getElementById("modal-combos").addEventListener("click", () => {document.getElementById("modal-combos").classList.remove("active")});
    document.getElementById("btn-show-combos").addEventListener("click", () => {document.getElementById("modal-combos").classList.add("active")});
});

