var config = require("../../config.js");
var core = require("../core.js");

function get_lightstring(qlabconn, cue){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/lightCommandText`))
    });
}

function set_lightstring(qlabconn, cue, lightstring){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/lightCommandText`, [{"type" : 's', "value" : lightstring}]))
    });
}

function set_light(qlabconn, cue, name, property, integer){
    return new Promise(resolve => {
        if (property == "intensity") {
            string = `${name}`
        } else {
            string = `${name}.${property}`
        }
        resolve(core.send_message(qlabconn, `/cue/${cue}/setLight`, [{"type" : 's', "value" : string}, {"type" : 'f', "value" : integer}]))
    });
}

function all_off(qlabconn, cue){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/setLight`, [{"type" : 's', "value" : 'all'}, {"type" : 'f', "value" : 0}]))
    });
}

module.exports.get_lightstring = get_lightstring
module.exports.set_lightstring = set_lightstring
module.exports.set_light = set_light
module.exports.all_off = all_off