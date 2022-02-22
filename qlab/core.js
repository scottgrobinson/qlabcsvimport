var async = require('async');

async function send_message(qlabconn, address, arguments) {
    return new Promise((resolve, reject) => {
        currentMessage = {'address' : address, 'status' : false}

        qlabconn.send({
            address: address,
            args: arguments
        });
    
        function checkMessageStatus(callback) {
            if(currentMessage['address'] == address && currentMessage['status'] == 'ok') {
                callback(null, currentMessage['data']) // No Error
            } else if (currentMessage['address'].match(address.replace('/cue/selected/', 'cue_id\/.*\/')) && currentMessage['status'] == 'ok'){
                callback(null, currentMessage['data']) // No Error
            } else {
                callback(true) // Error
            }
        }
    
        async.retry({times: 10, interval: 100}, checkMessageStatus, function(err, result) {
            if(err) {
                throw new Error(`Error sending message ${JSON.stringify(arguments)} to ${address} - No response received`)
            } else {
                resolve(result)
            }
        });
    });
}

module.exports.send_message = send_message