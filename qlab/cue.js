var helper = require("../helper.js"),
    core = require("./core.js");

/**
 * Creates a new cue of the specified type
 * @param {string} cuetype The cuetype to create
 * @returns {Promise} 
 */
function create(cuetype) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/new`, { "type": 's', "value": cuetype }))
    });
}

/**
 * Moves the specified cue into a previously created group
 * @param {string} cue The cue to move
 * @param {string} parent The parent group to move the cue into
 * @returns {Promise}
 */
function move(cue, parent) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/move/${cue}`, [{ "type": 'f', "value": 9999999 }, { "type": 's', "value": parent }]))
    });
}

/**
 * Sets the name of the specifed cue
 * @param {string} cue The cue to rename
 * @param {string} name The name of the cue
 * @returns {Promise}
 */
function setName(cue, name) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/name`, { "type": 's', "value": name }))
    });
}

/**
 * Sets the mode on the specified cue
 * @param {string} cue The cue to set the mode on
 * @param {number} mode The mode to set
 * @returns {Promise}
 */
function setMode(cue, mode) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/mode`, { "type": 'f', "value": mode }))
    });
}

/**
 * Selects the specified cue by ID
 * @param {string} cue The cue ID to select
 * @returns {Promise}
 */
function selectById(cue) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/select_id/${cue}`))
    });
}

/**
 * Selects the specified cue by number
 * @param {string} cuenum The cue number to select
 * @returns {Promise}
 */
function selectByNumber(cuenum) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/select/${cuenum}`))
    });
}

/**
 * Sets the continue mode on the specified cue
 * @param {string} cue The cue to set the continue mode on
 * @param {number} mode The continue mode to set
 * @returns {Promise}
 */
function setContinueMode(cue, mode) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/continueMode`, { "type": 'f', "value": mode }))
    });
}

/**
 * Sets the target ID on the specified cue
 * @param {string} cue The cue to set the target ID on 
 * @param {string} target The target ID to set
 * @returns {Promise}
 */
function setTargetID(cue, target) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/cueTargetId`, { "type": 's', "value": target }))
    });
}

/**
 * Sets the number/ID of the specified cue
 * @param {string} cue The cue to set the number/ID on
 * @param {string} number The number/ID to set
 * @returns {Promise}
 */
function setNumber(cue, number) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/number`, { "type": 's', "value": number }))
    });
}

/**
 * Sets the duration on the specified cue
 * @param {string} cue The cue to set the duration on
 * @param {number} duration The duration to set
 * @returns {Promise}
 */
function setDuration(cue, duration) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/duration`, { "type": 'f', "value": duration }))
    });
}

/**
 * Gets the duration of the specified cue
 * @param {string} cue The cue to get the duration of 
 * @returns {Promise}
 */
function getDuration(cue) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/duration`))
    });
}

/**
 * Sets the pre-wait time on the specified cue
 * @param {string} cue The cue to set the pre-wait time on
 * @param {number} wait The pre-wait time to set
 * @returns {Promise} 
 */
function setPreWait(cue, wait) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/preWait`, { "type": 'f', "value": wait }))
    });
}

/**
 * Gets the pre-wait time of the specified cue
 * @param {*} cue The cue to get the pre-wait time on
 * @returns {Promise}
 */
function getPreWait(cue) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/preWait`))
    });
}

/**
 * Sets the color of the specified cue
 * @param {string} cue The cue to set the color on
 * @param {string} color The color to set
 * @returns {Promise}
 */
function setColor(cue, color) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/colorName`, { "type": 's', "value": color }))
    });
}

/**
 * Lists the cues in the workspace
 * @returns {Promise}
 */
function list() {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/workspace/${helper.qlabworkspaceid}/cueLists`))
    });
}

/**
 * Gets the light string of the specified cue
 * @param {string} cue The cue to get the light string from
 * @returns {Promise}
 */
function getLightString(cue) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/lightCommandText`))
    });
}

/**
 * Sets the light string on the specified cue
 * @param {string} cue The cue to set the light string on
 * @param {string} lightstring The light string to set
 * @returns {Promise}
 */
function setLightString(cue, lightstring) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/lightCommandText`, [{ "type": 's', "value": lightstring }]))
    });
}

/**
 * Sets the network patch on the specified cue
 * @param {string} cue The cue to set the network patch on
 * @param {number} networkpatch The network patch to set
 * @returns {Promise}
 */
function setNetworkPatch(cue, networkpatch) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/patch`, [{ "type": 'f', "value": networkpatch }]))
    });
}

/**
 * Sets the network string on the specified cue
 * @param {string} cue The cue to set the network string on
 * @param {string} networkstring The network string to set
 * @returns {Promise}
 */
function setNetworkString(cue, networkstring) {
    return new Promise(resolve => {
        resolve(core.sendMessage(`/cue/${cue}/customString`, [{ "type": 's', "value": networkstring }]))
    });
}

module.exports.create = create
module.exports.move = move
module.exports.setName = setName
module.exports.setMode = setMode
module.exports.selectById = selectById
module.exports.selectByNumber = selectByNumber
module.exports.setContinueMode = setContinueMode
module.exports.setTargetID = setTargetID
module.exports.setNumber = setNumber
module.exports.setDuration = setDuration
module.exports.getDuration = getDuration
module.exports.setPreWait = setPreWait
module.exports.getPreWait = getPreWait
module.exports.setColor = setColor
module.exports.list = list
module.exports.getLightString = getLightString
module.exports.setLightString = setLightString
module.exports.setNetworkPatch = setNetworkPatch
module.exports.setNetworkString = setNetworkString