var config = require("../../config.js");
var core = require("../core.js");

function create(qlabconn, cuetype) {
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/workspace/${config.qlabworkspaceid}/new`, {"type" : 's', "value" : cuetype}))
    });
}

function move(qlabconn, cue, parent) {
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/workspace/${config.qlabworkspaceid}/move/${cue}`, [{"type" : 'f', "value" : 9999999}, {"type" : 's', "value" : parent}]))
    });
}

function set_name(qlabconn, cue, name){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/name`, {"type" : 's', "value" : name}))
    });
}

function set_mode(qlabconn, cue, mode){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/mode`, {"type" : 'f', "value" : mode}))
    });
}

function select(qlabconn, cue){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/workspace/${config.qlabworkspaceid}/select_id/${cue}`))
    });
}

function set_continue_mode(qlabconn, cue, mode){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/continueMode`, {"type" : 'f', "value" : mode}))
    });
}

function set_target_id(qlabconn, cue, target){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/cueTargetId`, {"type" : 's', "value" : target}))
    });
}

function set_duration(qlabconn, cue, duration){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/duration`, {"type" : 'f', "value" : duration}))
    });
}

function get_duration(qlabconn, cue){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/duration`))
    });
}

function set_prewait(qlabconn, cue, wait){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/preWait`, {"type" : 'f', "value" : wait}))
    });
}

function set_fadeandstop(qlabconn, cue) {
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/fadeAndStopOthers`, {"type" : 'f', "value" : 1}))
    });
}

function set_color(qlabconn, cue, color) {
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/cue/${cue}/colorName`, {"type" : 's', "value" : color}))
    });
}

function list(qlabconn){
    return new Promise(resolve => {
        resolve(core.send_message(qlabconn, `/workspace/${config.qlabworkspaceid}/cueLists`))
    });
}

module.exports.create = create
module.exports.move = move
module.exports.set_name = set_name
module.exports.set_mode = set_mode
module.exports.select = select
module.exports.set_continue_mode = set_continue_mode
module.exports.set_target_id = set_target_id
module.exports.set_duration = set_duration
module.exports.get_duration = get_duration
module.exports.set_prewait = set_prewait
module.exports.set_fadeandstop = set_fadeandstop
module.exports.set_color = set_color
module.exports.list = list