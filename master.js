import GLPK from './glpk.js';

const DATA_URL = "data.json";
var glpk;
var PREVIOUS_CONFIG = null;

class Model {
    constructor(data, config) {
        this.data = data;
        this.config = config;
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
        this._createVariables();
        this._createConstraints();
        this._createObjective();
    }

    _createVariables() {
        this.data.weapons.base.forEach(weapon => {
            this.problem.binaries.push(`b_${weapon}`);
            this.problem.generals.push(`w_${weapon}`);
        });
        this.data.weapons.evolved.forEach(weapon => {
            this.problem.binaries.push(`e_${weapon}`);
            this.problem.generals.push(`w_${weapon}`);
        });
        this.data.items.forEach(item => {
            this.problem.binaries.push(`i_${item}`);
        });
        this.data.weapons.base.concat(this.data.weapons.evolved).forEach(weapon => {
            this.data.items.forEach(item => {
                if (this.data.combos[weapon][item] > 0) {
                    this.problem.binaries.push(`c_${weapon}_${item}`);
                }
            });
        });
    }

    _createInventoryConstraints() {
        let expr = [];
        this.data.weapons.base.concat(this.data.weapons.evolved).forEach(weapon => {
            expr.push({
                name: `w_${weapon}`,
                coef: 1,
            });
            this.problem.subjectTo.push({
                name: `bounds_${weapon}`,
                vars: [{
                    name: `w_${weapon}`,
                    coef: 1,
                }],
                bnds: {
                    type: glpk.GLP_DB,
                    ub: 1,
                    lb: -1
                }
            });
        });
        this.problem.subjectTo.push({
            name: "inventory_weapons",
            vars: expr,
            bnds: {
                type: glpk.GLP_FX,
                ub: 6,
                lb: 6
            }
        });
        expr = [];
        this.data.items.forEach(item => {
            expr.push({
                name: `i_${item}`,
                coef: 1
            })
        });
        this.problem.subjectTo.push({
            name: "inventory_items",
            vars: expr,
            bnds: {
                type: glpk.GLP_FX,
                ub: 6 + this.config.map_items.length,
                lb: 6 + this.config.map_items.length
            }
        });
    }

    _createWeaponConstraints() {
        let weapons_with_evolution = {};
        this.data.evolutions.forEach(evolution => {
            evolution.base_weapons.forEach(weapon => {
                weapons_with_evolution[weapon] = true;

                // Evolution requires weapon
                this.problem.subjectTo.push({
                    name: `evolution_requires_weapon_${weapon}`,
                    vars: [{
                            name: `e_${evolution.evolved_weapon}`,
                            coef: 1
                        },
                        {
                            name: `b_${weapon}`,
                            coef: -1
                        }
                    ],
                    bnds: {
                        type: glpk.GLP_UP,
                        ub: 0,
                    }
                });

                // Evolution consumes weapon
                this.problem.subjectTo.push({
                    name: `inventory_evolved_${weapon}`,
                    vars: [{
                            name: `w_${weapon}`,
                            coef: 1
                        },
                        {
                            name: `b_${weapon}`,
                            coef: -1
                        },
                        {
                            name: `e_${evolution.evolved_weapon}`,
                            coef: 1
                        }
                    ],
                    bnds: {
                        type: glpk.GLP_FX,
                        ub: 0,
                        lb: 0
                    }
                });

            });

            // Evolving a weapon adds it to inventory
            this.problem.subjectTo.push({
                name: `inventory_evolution_${evolution.evolved_weapon}`,
                vars: [{
                        name: `w_${evolution.evolved_weapon}`,
                        coef: 1
                    },
                    {
                        name: `e_${evolution.evolved_weapon}`,
                        coef: -1
                    }
                ],
                bnds: {
                    type: glpk.GLP_FX,
                    ub: 0,
                    lb: 0
                }
            });

            // Evolution requires item
            if (evolution.item != null) {
                this.problem.subjectTo.push({
                    name: `evolution_requires_item_${evolution.item}`,
                    vars: [{
                            name: `e_${evolution.evolved_weapon}`,
                            coef: 1
                        },
                        {
                            name: `i_${evolution.item}`,
                            coef: -1
                        }
                    ],
                    bnds: {
                        type: glpk.GLP_UP,
                        ub: 0,
                    }
                });
            }

        });

        // Weapons not evolved are in inventory
        this.data.weapons.base.forEach(weapon => {
            if (!(weapon in weapons_with_evolution)) {
                this.problem.subjectTo.push({
                    name: `inventory_not_evolved_${weapon}`,
                    vars: [{
                            name: `w_${weapon}`,
                            coef: 1
                        },
                        {
                            name: `b_${weapon}`,
                            coef: -1
                        }
                    ],
                    bnds: {
                        type: glpk.GLP_FX,
                        ub: 0,
                        lb: 0
                    }
                });
            }
        });
    }

    _createComboConstraints() {
        this.data.weapons.base.concat(this.data.weapons.evolved).forEach(weapon => {
            this.data.items.forEach(item => {
                if (this.data.combos[weapon][item] > 0) {
                    this.problem.subjectTo.push({
                        name: `combo_weapon_${weapon}_${item}`,
                        vars: [{
                                name: `c_${weapon}_${item}`,
                                coef: 1
                            },
                            {
                                name: `w_${weapon}`,
                                coef: -1
                            }
                        ],
                        bnds: {
                            type: glpk.GLP_UP,
                            ub: 0,
                        }
                    });
                    this.problem.subjectTo.push({
                        name: `combo_item_${weapon}_${item}`,
                        vars: [{
                                name: `c_${weapon}_${item}`,
                                coef: 1
                            },
                            {
                                name: `i_${item}`,
                                coef: -1
                            }
                        ],
                        bnds: {
                            type: glpk.GLP_UP,
                            ub: 0,
                        }
                    });
                }
            });
        });
    }

    _createConfigConstraints() {
        this.config.weapons.forEach(weapon => {
            if (this.data.weapons.base.includes(weapon)) {
                this.problem.subjectTo.push({
                    name: `config_weapon_base_${weapon}`,
                    vars: [{
                        name: `b_${weapon}`,
                        coef: 1
                    }],
                    bnds: {
                        type: glpk.GLP_FX,
                        ub: 1,
                        lb: 1
                    }
                });
            } else if (this.data.weapons.evolved.includes(weapon)) {
                this.problem.subjectTo.push({
                    name: `config_weapon_evolved_${weapon}`,
                    vars: [{
                        name: `e_${weapon}`,
                        coef: 1
                    }],
                    bnds: {
                        type: glpk.GLP_FX,
                        ub: 1,
                        lb: 1
                    }
                });
            }
        });

        this.config.items.concat(this.config.map_items).forEach(item => {
            this.problem.subjectTo.push({
                name: `config_item_${item}`,
                vars: [{
                    name: `i_${item}`,
                    coef: 1
                }],
                bnds: {
                    type: glpk.GLP_FX,
                    ub: 1,
                    lb: 1
                }
            });
        });

        this.config.ban.forEach(tag => {
            if (this.data.weapons.base.includes(tag)) {
                this.problem.subjectTo.push({
                    name: `config_ban_${tag}`,
                    vars: [{
                        name: `b_${tag}`,
                        coef: 1
                    }],
                    bnds: {
                        type: glpk.GLP_FX,
                        ub: 0,
                        lb: 0
                    }
                });
            } else if (this.data.weapons.evolved.includes(tag)) {
                this.problem.subjectTo.push({
                    name: `config_ban_${tag}`,
                    vars: [{
                        name: `e_${tag}`,
                        coef: 1
                    }],
                    bnds: {
                        type: glpk.GLP_FX,
                        ub: 0,
                        lb: 0
                    }
                });
            } else if (this.data.items.includes(tag)) {
                this.problem.subjectTo.push({
                    name: `config_ban_${tag}`,
                    vars: [{
                        name: `i_${tag}`,
                        coef: 1
                    }],
                    bnds: {
                        type: glpk.GLP_FX,
                        ub: 0,
                        lb: 0
                    }
                });
            }
        });
    }

    _createConstraints() {
        this._createInventoryConstraints();
        this._createWeaponConstraints();
        this._createComboConstraints();
        this._createConfigConstraints();
    }

    _createObjective() {
        // Creating objective
        this.data.weapons.base.concat(this.data.weapons.evolved).forEach(weapon => {
            this.data.items.forEach(item => {
                if (this.data.combos[weapon][item] > 0) {
                    this.problem.objective.vars.push({
                        name: `c_${weapon}_${item}`,
                        coef: this.config.coefCombo,
                    });
                }
            });
        });
        this.data.weapons.evolved.forEach(weapon => {
            this.problem.objective.vars.push({
                name: `e_${weapon}`,
                coef: this.config.coefEvolution,
            });
        });
    }
}


function resetInventory() {
    document.querySelectorAll(".inventory .inventory-cell").forEach(inventoryCellAux => {
        let imageInsideCell = inventoryCellAux.querySelector("img");
        if (imageInsideCell) {
            inventoryCellAux.removeChild(imageInsideCell);
        }
    });
    document.getElementById("combo-score").textContent = 0;
}


async function solveProblem(data, config) {
    glpk = await GLPK();
    const model = new Model(data, config);
    console.log(model);
    const solution = await glpk.solve(model.problem, glpk.GLP_MSG_ERR);
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

    resetInventory();

    let weaponInventoryTile = 1;
    data.weapons.base.forEach(weapon => {
        if (solution.result.vars[`w_${weapon}`] == 1) {
            let image = createInventoryItemImage(data, weapon);
            let container = document.querySelector(`.inventory-weapons .inventory-cell:nth-child(${weaponInventoryTile})`);
            container.innerHTML = "";
            container.appendChild(image);
            weaponInventoryTile++;
        }
    });
    data.weapons.evolved.forEach(weapon => {
        if (solution.result.vars[`w_${weapon}`] == 1) {
            let image = createInventoryItemImage(data, weapon);
            let container = document.querySelector(`.inventory-weapons .inventory-cell:nth-child(${weaponInventoryTile})`);
            container.innerHTML = "";
            container.appendChild(image);
            weaponInventoryTile++;
        }
    });

    let itemInventoryTile = 1;
    data.items.forEach(item => {
        if (solution.result.vars[`i_${item}`] == 1 && !config.map_items.includes(item)) {
            let image = createInventoryItemImage(data, item);
            let container = document.querySelector(`.inventory-items .inventory-cell:nth-child(${itemInventoryTile})`);
            container.innerHTML = "";
            container.appendChild(image);
            itemInventoryTile++;
        }
    });

    let mapItemInventoryTile = 1;
    data.items.forEach(item => {
        if (solution.result.vars[`i_${item}`] == 1 && config.map_items.includes(item)) {
            let image = createInventoryItemImage(data, item);
            let container = document.querySelector(`.inventory-bonus-items .inventory-cell:nth-child(${mapItemInventoryTile})`);
            container.innerHTML = "";
            container.appendChild(image);
            mapItemInventoryTile++;
        }
    });

    let banInventoryTile = 1;
    config.ban.forEach(tag => {
        let image = createInventoryItemImage(data, tag);
        let container = document.querySelector(`.inventory-row-ban .inventory-cell:nth-child(${banInventoryTile})`);
        container.innerHTML = "";
        container.appendChild(image);
        banInventoryTile++;
    });

    let totalCombo = 0;
    data.weapons.base.concat(data.weapons.evolved).forEach(weapon => {
        data.items.forEach(item => {
            if (data.combos[weapon][item] > 0) {
                if (solution.result.vars[`c_${weapon}_${item}`] == 1) {
                    totalCombo++;
                }
            }
        });
    });

    document.getElementById("combo-score").textContent = totalCombo;

}


function createInventoryItemImage(data, tag) {
    let image = document.createElement("img");
    image.src = `./sprites/${tag}.png`;
    image.className = "inventory-item";
    image.draggable = true;
    image.title = data.labels[tag];
    image.setAttribute("tag", tag);
    image.addEventListener("dragstart", (event => {
        event.dataTransfer.setData("text/plain", tag);
    }));
    return image;
}


function readConfig() {
    let config = {
        weapons: [],
        items: [],
        map_items: [],
        ban: [],
        coefCombo: 1,
        coefEvolution: 1
    }
    let configCoefInput = document.getElementById("config-coef");
    if (configCoefInput.value == 1) {
        config.coefCombo = 100;
        config.coefEvolution = 1;
    } else if (configCoefInput.value == 2) {
        config.coefCombo = 1;
        config.coefEvolution = 1;
    } else if (configCoefInput.value == 3) {
        config.coefCombo = 1;
        config.coefEvolution = 100;
    }
    document.querySelectorAll(".inventory-weapons img").forEach(imageInsideCell => {
        config.weapons.push(imageInsideCell.getAttribute("tag"));
    });
    document.querySelectorAll(".inventory-items img").forEach(imageInsideCell => {
        config.items.push(imageInsideCell.getAttribute("tag"));
    });
    document.querySelectorAll(".inventory-bonus-items img").forEach(imageInsideCell => {
        config.map_items.push(imageInsideCell.getAttribute("tag"));
    });
    document.querySelectorAll(".inventory-row-ban img").forEach(imageInsideCell => {
        config.ban.push(imageInsideCell.getAttribute("tag"));
    });
    return config;
}

function updateComboScore(data) {
    let config = readConfig();
    let score = 0;
    config.weapons.forEach(weapon => {
        config.items.forEach(item => {
            score += data.combos[weapon][item];
        });
    });
    document.getElementById("combo-score").textContent = score;
}


function getTagType(data, tag) {
    if (data.items.includes(tag)) {
        return "item";
    } else if (data.weapons.base.includes(tag)) {
        return "weapon";
    } else if (data.weapons.evolved.includes(tag)) {
        return "weapon";
    } else {
        return null;
    }
}


function getInventoryRowType(inventoryRow) {
    if (inventoryRow.classList.contains("inventory-weapons")) {
        return "weapon";
    } else if (inventoryRow.classList.contains("inventory-items")) {
        return "item";
    } else if (inventoryRow.classList.contains("inventory-bonus-items")) {
        return "item";
    } else {
        return null;
    }
}


function removeTagFromInventory(tag) {
    document.querySelectorAll(".inventory .inventory-cell").forEach(inventoryCellAux => {
        let imageInsideCell = inventoryCellAux.querySelector("img");
        if (imageInsideCell && imageInsideCell.src.endsWith(`sprites/${tag}.png`)) {
            inventoryCellAux.removeChild(imageInsideCell);
        }
    });
}


function loadData(data) {
    let itemLists = [{
            selector: ".list-weapons-base",
            array: data.weapons.base,
            type: "weapon"
        },
        {
            selector: ".list-weapons-evolved",
            array: data.weapons.evolved,
            type: "weapon"
        },
        {
            selector: ".list-items",
            array: data.items,
            type: "item"
        }
    ];
    itemLists.forEach(itemList => {
        let container = document.querySelector(itemList.selector);
        container.innerHTML = "";
        itemList.array.forEach(tag => {
            let image = createInventoryItemImage(data, tag);
            let wrapper = document.createElement("div");
            wrapper.appendChild(image);
            wrapper.className = "inventory-cell";
            container.appendChild(wrapper);
        });
    });

    document.querySelectorAll(".inventory-row").forEach(inventoryRow => {
        inventoryRow.querySelectorAll(".inventory-cell").forEach(inventoryCell => {
            inventoryCell.addEventListener("drop", (event) => {
                event.preventDefault();
                event.stopPropagation();
                let tag = event.dataTransfer.getData("text/plain");
                if (!inventoryCell.hasChildNodes() && (getInventoryRowType(inventoryRow) == null || getInventoryRowType(inventoryRow) == getTagType(data, tag))) {
                    let image = createInventoryItemImage(data, tag);
                    removeTagFromInventory(tag);
                    event.target.appendChild(image);
                }
                updateComboScore(data);
            });
            inventoryCell.addEventListener("dragover", (event) => {
                let tag = event.dataTransfer.getData("text/plain");
                if (!inventoryCell.hasChildNodes() && (getInventoryRowType(inventoryRow) == null || getInventoryRowType(inventoryRow) == getTagType(data, tag))) {
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
        let tag = event.dataTransfer.getData("text/plain");
        if (getTagType(data, tag) != null) {
            event.preventDefault();
            event.stopPropagation();
            removeTagFromInventory(tag);
        }
        updateComboScore(data);
    });

    document.getElementById("button-reset").addEventListener("click", () => {
        resetInventory();
    });

    document.getElementById("button-clear").addEventListener("click", () => {
        resetInventory();
        if (PREVIOUS_CONFIG != null) {
            let container;
            container = document.querySelector(".inventory-weapons");
            PREVIOUS_CONFIG.weapons.forEach((tag, index) => {
                container.querySelector(`.inventory-cell:nth-child(${index + 1}`).appendChild(createInventoryItemImage(data, tag));
            });
            container = document.querySelector(".inventory-items");
            PREVIOUS_CONFIG.items.forEach((tag, index) => {
                container.querySelector(`.inventory-cell:nth-child(${index + 1}`).appendChild(createInventoryItemImage(data, tag));
            });
            container = document.querySelector(".inventory-bonus-items");
            PREVIOUS_CONFIG.map_items.forEach((tag, index) => {
                container.querySelector(`.inventory-cell:nth-child(${index + 1}`).appendChild(createInventoryItemImage(data, tag));
            });
            container = document.querySelector(".inventory-row-ban");
            PREVIOUS_CONFIG.ban.forEach((tag, index) => {
                container.querySelector(`.inventory-cell:nth-child(${index + 1}`).appendChild(createInventoryItemImage(data, tag));
            });
        }
    });

    document.getElementById("button-generate").addEventListener("click", () => {
        let config = readConfig();
        PREVIOUS_CONFIG = config;
        solveProblem(data, config);
    });
}


window.addEventListener("load", () => {
    fetch(DATA_URL).then(res => res.json()).then(loadData);
});