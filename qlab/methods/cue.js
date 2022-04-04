var helper = require("../../helper.js");
var core = require("../core.js");

function create(cuetype) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/new`, { "type": 's', "value": cuetype }))
    });
}

function move(cue, parent) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/move/${cue}`, [{ "type": 'f', "value": 9999999 }, { "type": 's', "value": parent }]))
    });
}

function setName(cue, name) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/name`, { "type": 's', "value": name }))
    });
}

function setMode(cue, mode) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/mode`, { "type": 'f', "value": mode }))
    });
}

function select(cue) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/select_id/${cue}`))
    });
}

function setContinueMode(cue, mode) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/continueMode`, { "type": 'f', "value": mode }))
    });
}

function setTargetID(cue, target) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/cueTargetId`, { "type": 's', "value": target }))
    });
}

function setDuration(cue, duration) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/duration`, { "type": 'f', "value": duration }))
    });
}

function getDuration(cue) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/duration`))
    });
}

function setPreWait(cue, wait) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/preWait`, { "type": 'f', "value": wait }))
    });
}

function getPreWait(cue, wait) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/preWait`))
    });
}

function setColor(cue, color) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/colorName`, { "type": 's', "value": color }))
    });
}

function list() {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/cueLists`))
    });
}

module.exports.create = create
module.exports.move = move
module.exports.setName = setName
module.exports.setMode = setMode
module.exports.select = select
module.exports.setContinueMode = setContinueMode
module.exports.setTargetID = setTargetID
module.exports.setDuration = setDuration
module.exports.getDuration = getDuration
module.exports.setPreWait = setPreWait
module.exports.getPreWait = getPreWait
module.exports.setColor = setColor
module.exports.list = list