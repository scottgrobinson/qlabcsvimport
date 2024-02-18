const fs = require('fs'),
    { parse } = require('csv-parse'),
    qlabCore = require('./qlab/core.js'),
    qlabCue = require('./qlab/cue.js'),
    helper = require('./helper.js'),
    path = require('path')
const { exit } = require('process');

homedir = require('os').homedir();

const settingsFile = homedir + '/.qlabtools_data.json';
const lightcuelistcachefile = homedir + '/.qlabtools_lightcuelistcachefile.json';

let existingSettings = (function () {
    try {
        return JSON.parse(fs.readFileSync(settingsFile));
    } catch (err) {
        return {}
    }
})();

(async () => {
    // Ask the user to specify the parameters required, trying to read from the defined settings file first
    async function getNewSettings() {
        return new Promise((resolve, reject) => {
            const prompts = require('prompts');

            // Ask the questions
            (async () => {
                const onCancel = prompt => {
                    process.exit(1)
                }

                promptQuestions = [
                    {
                        type: 'text',
                        name: 'qlabip',
                        message: `qLab IP:`,
                        initial: 'qlabip' in existingSettings ? existingSettings['qlabip'] : '',
                        validate: qlabip => qlabip === '' ? 'Cannot be blank' : true
                    },
                    {
                        type: 'text',
                        name: 'qlabworkspaceid',
                        message: `qLab Workspace ID:`,
                        initial: 'qlabworkspaceid' in existingSettings ? existingSettings['qlabworkspaceid'] : '',
                        validate: qlabworkspaceid => qlabworkspaceid === '' ? 'Cannot be blank' : true
                    },
                    {
                        type: 'toggle',
                        name: 'uselightcuecache',
                        message: `Use light cue cache?:`,
                        initial: 'uselightcuecache' in existingSettings ? existingSettings['uselightcuecache'] : true,
                        active: 'yes',
                        inactive: 'no'
                    },
                    {
                        type: 'text',
                        name: 'destinationCueList',
                        message: `Cue list name where the created cues will be created:`,
                        initial: 'destinationCueList' in existingSettings ? existingSettings['destinationCueList'] : '',
                        validate: destinationCueList => destinationCueList === '' ? 'Cannot be blank' : true
                    }
                ]

                return resolve(await prompts(promptQuestions, { onCancel }));
            })();

        })
    }

    const settings = await getNewSettings();

    fs.writeFileSync(settingsFile, JSON.stringify(Object.assign({}, existingSettings, settings)));
    helper.qlabworkspaceid = settings['qlabworkspaceid']
    console.log()

    await qlabCore.init(settings['qlabip']);
    console.log()

    masterCueLists = await qlabCue.list();

    if (settings['uselightcuecache']) {
        try {
            lightCues = JSON.parse(fs.readFileSync(lightcuelistcachefile))
            console.log(`Using light cue cache file ${lightcuelistcachefile}\n`)
        } catch (err) {
            console.log('Unable to use light cue cache file - Generating light cues list (This may take upto 60 seconds, hold tight!)...\n')
            lightCues = await helper.generateInternalLightCueList(masterCueLists, lightcuelistcachefile)
        }
    } else {
        console.log('Generating light cues list (This may take upto 60 seconds, hold tight!)...\n')
        lightCues = await helper.generateInternalLightCueList(masterCueLists, lightcuelistcachefile)
    }

    if (Object.keys(lightCues).length == 0) {
        helper.showErrorAndExit('Unable to find light cues. Ensure \'Light Cues > Scenes\' & \'Light Cues > Chases\' cue lists exist')
    }

    //for (lightCue in lightCues) {
    //    if (lightCues[lightCue]["type"] == "Scenes") {
    //        console.log(lightCues[lightCue]);
    //    }
    //}

    // Find the destination cue list and exit if doesn't exist
    destinationcuelistid = false;
    for (list of masterCueLists) {
        if (list["listName"] == settings['destinationCueList']) {
            destinationcuelistid = list["uniqueID"];
            await qlabCue.selectById(destinationcuelistid)
            break;
        }
    }
    if (!destinationcuelistid) {
        showErrorAndExit(`Unable to find destination cue list "${settings['destinationCueList']}"`);
    }

    // Essentially select the last item in the cue list
    await qlabCue.selectByNumber("9999999999");

    for (lightCue in lightCues) {
        if (lightCues[lightCue]["type"] == "Scenes") {
            let newcue = await qlabCue.create("light");
            await qlabCue.setName("selected", lightCue);
            let fixtureSettings = await helper.combineSceneFixtures([lightCue])
            let newFixtureSettings = []
            newFixtureSettings['all.master'] = 0
            newFixtureSettings['all.red'] = 0
            newFixtureSettings['all.green'] = 0
            newFixtureSettings['all.blue'] = 0
            newFixtureSettings['all.white'] = 0
            newFixtureSettings['all.intensity'] = 0
            newFixtureSettings['all.coldsparklevel'] = 0
            for (fixtureSetting in fixtureSettings) {
                if (fixtureSettings[fixtureSetting] != 0) {
                    newFixtureSettings[fixtureSetting] = fixtureSettings[fixtureSetting];
                }
            }
            await qlabCue.setLightString("selected", helper.listOfFixturesToStringOfFixtures(newFixtureSettings));
            await qlabCue.setDuration("selected", "00.000");
        }
    }

    console.log("Finished!");
    process.exit(0);

})();