var core = require("../core.js");

function getLightString(cue) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/lightCommandText`))
    });
}

function setLightString(cue, lightstring) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/lightCommandText`, [{ "type": 's', "value": lightstring }]))
    });
}

function set_light(cue, name, property, integer) {
    return new Promise(resolve => {
        if (property == "intensity") {
            string = `${name}`
        } else {
            string = `${name}.${property}`
        }
        resolve(core.sendMessage(`/cue/${cue}/setLight`, [{ "type": 's', "value": string }, { "type": 'f', "value": integer }]))
    });
}

function all_off(cue) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/setLight`, [{ "type": 's', "value": 'all' }, { "type": 'f', "value": 0 }]))
    });
}

module.exports.getLightString = getLightString
module.exports.setLightString = setLightString
module.exports.set_light = set_light
module.exports.all_off = all_off