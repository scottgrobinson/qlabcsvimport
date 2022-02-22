var osc = require('osc'),
    core = require('./core.js');

let qlabconn = new osc.TCPSocketPort({});

module.exports = function(qlabip) {
    qlabconn.open(qlabip, 53000);

    qlabconn.on('error', (error) => {
        console.log("An OSC error occurred:", error.message);
        process.exit(1);
    });

    return new Promise((resolve, reject) => {
        qlabconn.on('ready', () => {
            console.log('Connected to QLab!');

            (async () => {
                let sendmsg = await core.send_message(qlabconn, `/alwaysReply`, {"type" : 'f', "value" : 1})
                resolve(qlabconn);
            })();
        });
    })
}

// On receiving an OSC message from QLab
qlabconn.on("message", function (oscMsg) {
    //console.log("An OSC message just arrived!", oscMsg);

    oscMsg = JSON.parse(oscMsg['args'])
    currentMessage = {'address' : oscMsg['address'], 'status' : oscMsg['status'], 'data' : oscMsg['data']}
});