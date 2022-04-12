# qlabcsvimport

## Overview

Creates lighting cues from a CSV file (Created in adobe audition, but can created anywhere so long as the format matches!) and imports them into qLab.

This was specfically created to aid in creating lighting for Attleborough Players shows, however, I decided to stick the code up here anyway incase it's of use to anyone! It's probably fairly niche.. But if nothing else, this read-me will remind me of what's happening here as it's ussually a year or two between ever using this/needing to make updates.

### app.js

Run with "node app.js" and it will:

- Connect to qLab and ensure the correct cue lists exist
- Pull the list of scenes and chasers from qLab
- Validate that the lights specified in the CSV exist in qLab
- Combine scenes/chasers into groups where the start time & durations match
- Create scenes/chasers at the specified start times with the specified durations

![qLab Screenshot](/screenshot.png?raw=true)

On first running the script, a number of questions are asked including "Remove fixtures from a chase if combined in a group with a scene that has a fixture contained within the chase?". When creating a group (scenes/chasers that start at the same time with the same duration)...

- Warn: Will warn you if you have any light fixtures in your chasers that would override what is set on the scene in that group. I.E If the scene has a Spotlight on, but a chaser turns the spotlight on and off, we will warn about this only.
- Remove: Will remove any light fixtures in the chasers that would override what is set on the scene in that group. I.E If the scene has a Spotlight on, but a chaser turns the spotlight on and off, we will remove the spotlight from the chaser.
### export.js

Run with "node export.js" and it will:

- Connect to qLab and ensure that the correct cue lists exist
- Export all of the data from the "Dump" list to a JSON file

This script was specifically created to allow easily comparison between major code changes in the app. I.E Create a json export before the major code changes, re-import all of the CSV files, create another json export, and then use a tool such as WinMerge to validate that the data is the same, or has only changed where expected.

## To-Do

- Add tests! There are none :(
- Add additional comments in some of the larger functions / Break up some of the larger functions
- Break up logic in helper.combineCuesByStartAndDuration (It works - But it makes no sense any more... I clearly wrote this in a rush!)
- Break up logic in helper.processCSVData (It works - But it could be more readable)
