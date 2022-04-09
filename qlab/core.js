var osc = require('osc'),
    async = require('async'),
    helper = require('../helper.js');;

let qlabconn = new osc.TCPSocketPort({});

/**
 * Initialises the qLab connection
 * @param {string} qlabip The qLab IP to connect to
 * @returns {Promise}
 */
async function init(qlabip) {
    console.log(`Attempting to connect to qLab at ${qlabip}\n`)

    qlabconn.open(qlabip, 53000);

    qlabconn.on('error', (error) => {
        helper.showErrorAndExit(`An OSC error occurred: ${error.message}`)
    });

    return new Promise((resolve, reject) => {
        qlabconn.on('ready', () => {
            console.log('Connected to qLab!');

            (async () => {
                let sendmsg = await sendMessage(`/alwaysReply`, { "type": 'f', "value": 1 })
                resolve(qlabconn);
            })();
        });
    })
}

/**
 * Sends an OSC message to qLab
 * @param {string} address The address of the message
 * @param {*} arguments Parameters to pass with the message
 * @returns {Promise}
 */
async function sendMessage(address, arguments) {
    return new Promise((resolve, reject) => {
        currentMessage = { 'address': address, 'status': false }

        qlabconn.send({
            address: address,
            args: arguments
        });

        function checkMessageStatus(callback) {
            if (currentMessage['address'] == address && currentMessage['status'] == 'ok') {
                callback(null, currentMessage['data']) // No Error
            } else if (currentMessage['address'].match(address.replace('/cue/selected/', 'cue_id\/.*\/')) && currentMessage['status'] == 'ok') {
                callback(null, currentMessage['data']) // No Error
            } else {
                callback(true) // Error
            }
        }

        async.retry({ times: 10, interval: 250 }, checkMessageStatus, function (err, result) {
            if (err) {
                helper.showErrorAndExit(`No response received when sending ${JSON.stringify(arguments)} to ${address}`)
            } else {
                resolve(result)
            }
        });
    });
}

// On receiving an OSC message from QLab
qlabconn.on("message", function (oscMsg) {
    //console.log("An OSC message just arrived!", oscMsg);
    oscMsg = JSON.parse(oscMsg['args'])
    currentMessage = { 'address': oscMsg['address'], 'status': oscMsg['status'], 'data': oscMsg['data'] }
});

module.exports.init = init
module.exports.sendMessage = sendMessage