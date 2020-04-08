Cambridge Makespace COVID-19 Visor Traceability Job Card System
===============================================================

    Copyright (C) 2020  Dan Hagon

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.    

    
This project provides traceability for
[Cambridge Makespace COVID-19 visor production project](https://web.makespace.org/visor/). See also
[https://github.com/Makespace/visor/](https://github.com/Makespace/visor/)

The visor design was based on one developed by the [University of Wisconsin](https://making.engr.wisc.edu/shield/).

The original system evolved from a simplified [Google Forms](https://www.google.co.uk/forms/about/) front end for a
[Google Sheets](https://www.google.co.uk/sheets/about/) spreadsheet to a
[Google Apps Script](https://developers.google.com/apps-script/guides/web) Web App. The intention is to provide a
[Node.js](nodejs.org) re-implementation to overcome the limitations of Google Apps Scripts.

# Installation

The code and example spreadsheet can be found in `google_apps_script_web_app`. First create a blank sheet in
[Google Sheets](https://docs.google.com/spreadsheets/u/0/) and click the title to give is a meaningful name. The select
`File > Import` and upload the example spreadsheet `Sign in out + Goods In Out + Job Cards.xlsx` either as a new
spreadsheet or to replace the current one. `Sign in out + Goods In Out + Job Cards.xlsx` provides the schema for the
system and will hold all the data generated. (In subsequent implementations this would be a database but for fast
development and ease of access by team members it's kept as a spreadsheet for now.)

To allow admins to share the sheet click the `Share` button in the top right of the window, followed by `Get shareable
link` which will give you a URL such as:

    https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit?usp=sharing

Make a note of `<SPREADSHEET_ID>` since it will be required by the web app shortly. Additionally it's worth changing the
format of column `J` (`Completion Time`) to `Date time` otherwise, for some reason, the only the date is display and the
full record is not available in the CSV file.

Next create a new Google Apps Script by going [here](https://script.google.com/home) and clicking `New project` in the
top left of the window and give the project a meanful name, such as `Example Job Card System`, by typing `Ctrl-S`.
Create new blank source files by selecting `File > New > Script file` or `File > New > HTML file` so that the files
reflect the names of files found in `google_apps_script_web_app` of this repo. For each one copy the contents to the
corresponding file in the project.

In the file `Spreadsheet.gs` there is a `mainSpreadsheet` variable that should reference the `<SPREADSHEET_ID>` you made
a note of above so replace that value with the one you have.

At this point you should be ready to
[deploy it](https://developers.google.com/apps-script/guides/web#deploying_a_script_as_a_web_app) and test that it
works. It is recommended to deploy it as suggested in the official Google documentation so that any tweaks you make are
not immediately visable. To test the development version select `Publish > Deploy as web app...` and for
`Project version` select `New` and give a description such as `Inital version` (although you can leave this blank if
you choose). Assuming you have access to the spreadsheet it should be fine to select yourself as who to execute the app
as. However, for `Who has access to the app` you should select `Anyone, even anonymous`. This was necessary since each
workstation has a [Chromebook](https://www.google.com/intl/en_uk/chromebook/) with Guest login. This is one of the
limitations of using Google Apps Scripts which future implementations of the job card system should avoid. Finally click
`Deploy` and review permissions. Usually the app won't be verified so you can proceed when this comes up.

Eventually you'll get to a dialog that has `Current web app URL` and in the box is the URL of the deployed web app
(which ends in `/exec/`) which is the one you should be running on the Chromebooks. The development version (which ends
in `/exec/`) can be found in the hyperlink just below this.

# Guidance for admins

 - If times look strange then check the timezone properties in either the script project or the spreadsheet.
 - Periodically check the contents of each of the tabs in the spreadsheet in case there is an issue that needs to be
   brought to someone's attention (e.g. someone ticks yes for has symptoms) or there is a data entry issue that needs
   correcting. Important: values in the `comment` column are not automatically used for traceability, they are only for
   humans, so ensure the values in the `Lots Consumed` column accurately reflect what occurred.
 - The is the schema of the `JobLog` sheet. Please note that the order of the columns on any sheet is important for the
 web app scripts.
     - `Lot number` the automatically generated number that gets printed on job cards ("carriers") for WIP boxes.
     - `Workstation` the location where the job takes place; must one of `Void`, `GoodsIn`, `LaserCutShield`, `CutFoam`,
       `CutElastic`, `StickFoamToShield`, `StapleElasticToShield`, `QualityControlPass`, `QualityControlFail`,
       `Boxing` or `GoodsOut` where `Void` can be used to denote voided lot numbers since these should be kept
       contiguous; normally it's a good idea to write a comment when a lot number become voided.
     - `Worker` the name of the primary worker for the job which must be identical with the corresponding name given on
       registration in the `Workers` sheet.
     - `Job Card Generation Time` the date time when the job card was generated in the system
     - `Lots Consumed` a semi-colon (`;`) separated list of lot numbers, with the exception of `GoodsIn` lots where the
       identifier comes from the `Goods In` sheet.
     - `Box Number` (optional) used in `QualityControlPass` or `Boxing` to indicate the	number present on the box sticker
     - `Comment` a semi-colon (`;`) delimited list of human-readable comments.
     - `Additional Worker 1` the name of the first additional worker for the job which must be identical with the
       corresponding name given on registration in the `Workers` sheet.
     - `Additional Worker 2` the name of the second additional worker for the job which must be identical with the
       corresponding name given on registration in the `Workers` sheet.
     - `Completion Time` the date time when the job was completed but not necessarily consumed by any down-stream jobs
     - `Lot Consumed Time` the date time of when this lot was consumed by a down-stream job; a completely empty entry
        here indicates this job is still WIP
     - `Retired by`	the name of the worker the retired this job which must be identical with the corresponding name
       give non registration in the `Workers` sheet; since retiring is an operation only on the job card carrier this
       individual is not counted for traceability purposes.

# Reporting

In `reporting` there are Python 3.8 scripts that can be used to report various useful pieces of information about the
system. The intention is that eventually these will be migrated into the web app itself. To install the prerequisites:

    $ pip install graphviz pprint

The script requires a CSV file of the "JobLog" sheet from the Google Sheets spreadsheet. To obtain this select `File >
Download > Comma-separated values (.csv, current sheet)`. For details of how to run the reports against a saved CSV file
checkout the help text:

    $ python reporting.py --help
