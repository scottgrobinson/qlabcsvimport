const fs = require('fs'),
  qlabCore = require('./qlab/core.js'),
  qlabCue = require('./qlab/cue.js'),
  helper = require('./helper.js'),
  homedir = require('os').homedir();

const settingsFile = homedir + '/.qlabtools_data.json';

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

        return resolve(await prompts([
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
            type: 'text',
            name: 'outputdir',
            message: `Output directory:`,
            initial: 'outputdir' in existingSettings ? existingSettings['outputdir'] : '',
            validate: outputdir => outputdir === '' ? 'Cannot be blank' : true,
            format: outputdir => outputdir
          },
          {
            type: 'text',
            name: 'sourceCueList',
            message: `Source cue list  where the created cues will be pulled from:`,
            initial: 'sourceCueList' in existingSettings ? existingSettings['sourceCueList'] : '',
            validate: sourceCueList => sourceCueList === '' ? 'Cannot be blank' : true
          }
        ], { onCancel }));
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

  // Find the temporary "dump" cue list and exit if doesn't exist
  dumpcuelistid = false
  for (list of masterCueLists) {
    if (list['listName'] == settings['sourceCueList']) {
      dumpcuelistid = list['uniqueID']
      break
    }
  }
  if (!dumpcuelistid) {
    helper.showErrorAndExit(`Unable to find temporary dump cue list '${settings['sourceCueList']}'`)
  }

  console.log(`Starting export of workspace ${settings['qlabworkspaceid']}`)

  // Loop over all elements in the settings['sourceCueList'] cue list and export them to JSON
  data = {}
  for (list of masterCueLists) {
    if (list['listName'] == settings['sourceCueList']) {
      for (cueL1 in list['cues']) {
        cueL1Name = list['cues'][cueL1]['name']

        console.log(`Starting export of workspace ${settings['qlabworkspaceid']}/${cueL1Name}`)

        data[cueL1Name] = []
        for (cueL2 in list['cues'][cueL1]['cues']) {
          cueL2Data = {}
          cueL2Name = list['cues'][cueL1]['cues'][cueL2]['name']
          cueL2Type = list['cues'][cueL1]['cues'][cueL2]['type']
          cueL2Num = list['cues'][cueL1]['cues'][cueL2]['number']
          cueL2Data[cueL2Name] = {
            "type": cueL2Type,
            "duration": await qlabCue.getDuration(cueL2Num),
            "prewait": await qlabCue.getPreWait(cueL2Num),
            "components": [],
          }
          if (cueL2Type == "Light") {
            cueL2Data[cueL2Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabCue.getLightString(cueL2Num))
          }
          for (cueL3 in list['cues'][cueL1]['cues'][cueL2]['cues']) {
            cueL3Data = {}
            cueL3Name = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['name']
            cueL3Type = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['type']
            cueL3Num = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['number']
            cueL3Data[cueL3Name] = {
              "type": cueL3Type,
              "duration": await qlabCue.getDuration(cueL3Num),
              "prewait": await qlabCue.getPreWait(cueL3Num),
              "components": []
            }
            if (cueL3Type == "Light") {
              cueL3Data[cueL3Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabCue.getLightString(cueL3Num))
            }
            cueL2Data[cueL2Name]["components"].push(cueL3Data)
            for (cueL4 in list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues']) {
              cueL4Data = {}
              cueL4Name = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['name']
              cueL4Type = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['type']
              cueL4Num = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['number']
              cueL4Data[cueL4Name] = {
                "type": cueL4Type,
                "duration": await qlabCue.getDuration(cueL4Num),
                "prewait": await qlabCue.getPreWait(cueL4Num),
                "components": []
              }
              if (cueL4Type == "Light") {
                cueL4Data[cueL4Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabCue.getLightString(cueL4Num))
              }
              cueL3Data[cueL3Name]["components"].push(cueL4Data)
              for (cueL5 in list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues']) {
                cueL5Data = {}
                cueL5Name = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['name']
                cueL5Type = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['type']
                cueL5Num = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['number']
                cueL5Data[cueL5Name] = {
                  "type": cueL5Type,
                  "duration": await qlabCue.getDuration(cueL5Num),
                  "prewait": await qlabCue.getPreWait(cueL5Num),
                  "components": []
                }
                if (cueL5Type == "Light") {
                  cueL5Data[cueL5Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabCue.getLightString(cueL5Num))
                }
                cueL4Data[cueL4Name]["components"].push(cueL5Data)
                for (cueL6 in list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['cues']) {
                  cueL6Data = {}
                  cueL6Name = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['cues'][cueL6]['name']
                  cueL6Type = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['cues'][cueL6]['type']
                  cueL6Num = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['cues'][cueL6]['number']
                  cueL6Data[cueL6Name] = {
                    "type": cueL6Type,
                    "duration": await qlabCue.getDuration(cueL6Num),
                    "prewait": await qlabCue.getPreWait(cueL6Num),
                  }
                  if (cueL6Type == "Light") {
                    cueL6Data[cueL6Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabCue.getLightString(cueL6Num))
                  }
                  cueL5Data[cueL5Name]["components"].push(cueL6Data)
                }
              }
            }
          }
          data[cueL1Name].push(cueL2Data)
        }
      }
    }
  }

  let outputpath = settings['outputdir'] + settings['qlabworkspaceid'] + '.json'
  fs.writeFileSync(outputpath, JSON.stringify(data, null, 4));
  console.log(`Output workspace ${settings['qlabworkspaceid']} to ${outputpath}\n`)

  process.exit(0)

})();