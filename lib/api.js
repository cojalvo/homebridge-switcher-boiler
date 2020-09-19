const {spawn} = require('child_process');
const path = require('path');
let log, debug, deviceIP, deviceID, pythonPath, api;

function switcherCommand(method, deviceName, deviceIP, deviceID) {
    return new Promise((resolve, reject) => {
        let commandTimeout;
        let jsonPyResponse = "";
        const pathToScript = '"' + path.join(__dirname, 'switcher.py').replace(/\\/g, '\\\\') + '"';
        const pathToPython = pythonPath !== 'python' ? '"' + pythonPath.replace(/\\/g, '\\\\') + '"' : 'python';

        if (debug)
            log(`Running Command: ${pathToPython} ${pathToScript} ${method} ${deviceIP} ${deviceID}`);
        try {
            const command = `${pathToScript} ${method} ${deviceIP} ${deviceID} ${deviceName}`;
            console.log(`Start running command: ${command}`);
            var pyResponse = spawn(pathToPython, [command], {
                shell: true,
                detached: true
            });

            const killProcess = () => {
                process.kill(-pyResponse.pid);
            };
            api.on('shutdown', killProcess);

            pyResponse.stdout.on('data', (data) => {
                clearTimeout(commandTimeout);
                api.removeListener('shutdown', killProcess);
                jsonPyResponse += data
            });
            pyResponse.stderr.on('data', (data) => {
                // log(`error:${data}`)
                clearTimeout(commandTimeout);
                api.removeListener('shutdown', killProcess);
                reject(data.toString())
            });
            pyResponse.stderr.on('close', () => {
                clearTimeout(commandTimeout);
                api.removeListener('shutdown', killProcess);
                // if (debug)
                // 	log(jsonPyResponse)
                if (!jsonPyResponse) {
                    reject('Empty Response!')
                } else {
                    try {
                        console.log(`jsonPyResponse: ${JSON.stringify(jsonPyResponse)}`);
                        jsonPyResponse = JSON.parse(jsonPyResponse);
                        if (jsonPyResponse.status === 'success')
                            resolve(jsonPyResponse);
                        else {

                            reject('Error: ' + jsonPyResponse.message)
                        }
                    } catch (err) {
                        log(err);
                        log(jsonPyResponse);
                        reject('Could not parse JSON data: ' + jsonPyResponse)
                    }
                }
            })
        } catch (err) {
            log(err);
            reject(`SPAWN ERROR, can't run command ${method}!!!`)
        }
    })
}


module.exports = {

    init: (logInput, debugInput, apiInput, pythonPathInput, cachedIP, cachedId) => {
        log = logInput;
        debug = debugInput;
        api = apiInput;
        pythonPath = pythonPathInput;
        deviceIP = cachedIP;
        deviceID = cachedId
    },

    discover: async (logInput, debugInput, deviceName) => {
        const discover = await switcherCommand('discover', deviceName);
        deviceIP = discover.deviceIP;
        deviceID = discover.deviceID;
        // console.log('found device IP:', deviceIP)
        // console.log('found device ID:', deviceID)
        return discover
    },

    getState: async () => {
        const state = await switcherCommand('getState', null, deviceIP, deviceID);
        // console.log('recent state:')
        // console.log(state)
        return state
    },

    setState: async (turnOn) => {
        const setResponse = await switcherCommand((turnOn ? 'setOn' : 'setOff'), null, deviceIP, deviceID);
        // console.log('setResponse:')
        // console.log(setResponse)
        return setResponse
    },

    setDuration: async (time) => {
        const setResponse = await switcherCommand(('m' + time), null, deviceIP, deviceID);
        console.log('setResponse:');
        console.log(setResponse);
        return setResponse
    }
};