var osc = require('osc'),
    async = require('async');

let qlabconn = new osc.TCPSocketPort({});

async function init(qlabip) {
    qlabconn.open(qlabip, 53000);

    qlabconn.on('error', (error) => {
        console.log("An OSC error occurred:", error.message);
        process.exit(1);
    });

    return new Promise((resolve, reject) => {
        qlabconn.on('ready', () => {
            console.log('Connected to QLab!');

            (async () => {
                let sendmsg = await sendMessage(`/alwaysReply`, { "type": 'f', "value": 1 })
                resolve(qlabconn);
            })();
        });
    })
}

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
                throw new Error(`Error sending message ${JSON.stringify(arguments)} to ${address} - No response received`)
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