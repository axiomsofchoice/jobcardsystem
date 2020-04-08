/**
 *
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
 * 
 */

let mainSpreadsheet = SpreadsheetApp.openById('<SPREADSHEET_ID>');

let workersSheet = mainSpreadsheet.getSheetByName('Workers');
let signinSheet = mainSpreadsheet.getSheetByName('Signins');
let signoutSheet = mainSpreadsheet.getSheetByName('Signouts');
let goodsInSheet = mainSpreadsheet.getSheetByName('Goods In');
let jobLogSheet = mainSpreadsheet.getSheetByName('JobLog');

// Placeholder for when no worker is selected, assuming field is not required.
const default_no_worker_selected = "No worker selected";

// Wait on script locks for up to 30 seconds.
const waitLockPeriod = 30000;

function spreadsheetAccessWithLock(e, cb) {

  var ret_value = -1;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(waitLockPeriod);
    if (!lock.hasLock()) {
      console.error("Could not acquire lock");
      return ret_value;
    }
    
     ret_value = cb();

  } catch(err) {
    console.error(err);
    return ret_value;
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
    if (lock.hasLock()) {
       console.error("Lock violation");
    }
  }
  return ret_value;
}

function getCellForLotNumber(lot_number) {
    // Find the cell correspoding to the job card.
    var values = jobLogSheet.getDataRange().getValues();
    var jobCardRowNumber = -1;
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] == lot_number) {
        jobCardRowNumber = i;
      }
    }
    if (-1 == jobCardRowNumber) {
      console.error("Could not find lot_number: " + lot_number);
      return -1;
    }
  return jobCardRowNumber;
}

function appendWorkerDetails(e) {

  spreadsheetAccessWithLock(e, function() {

    var selectedSheet;
    var rowToAppend = [];
    if (e["workstation"] == "WorkerRegistration") {
      selectedSheet = workersSheet;
      
      let registration_time = new Date();
      let worker = e['name'][0];
      let makespace_member = e['makespace_member'] != null;
      let makespace_member_number = e['makespace_member_number'][0];
      let mobile = e['mobile'][0];
      let email = e['email'][0];      
      rowToAppend = [registration_time, worker, makespace_member, mobile, email, makespace_member_number];
    } else {   if (e["workstation"] == "WorkerSignIn") {
      selectedSheet = signinSheet;
      
      let signin_time = new Date();
      let worker = e['worker_name'][0];
      let symptoms = e['symptoms'] != null;
      let contact_with_carriers = e['contact_with_carriers'] != null;
      let in_same_household = e['in_same_household'] != null;
      let in_same_household_detail = checkWorkerName(e['in_same_household_detail'][0]);
      rowToAppend = [signin_time, worker, symptoms, contact_with_carriers, in_same_household, in_same_household_detail];
    } else {   if (e["workstation"] == "WorkerSignOut") {
      selectedSheet = signoutSheet;
      
      let signout_time = new Date();
      let worker = e['worker_name'][0];
      rowToAppend = [signout_time, worker];
    } } }

    selectedSheet.appendRow(rowToAppend);
    
  });
  
  return;
}

/**
 * Append completed received goods in form.
 */
function appendCompletedGoodsIn(e) {

  spreadsheetAccessWithLock(e, function() {
    
    let receivedDate = new Date();
    let carrier = e['carrier'][0];
    let material = e['material'][0];
    let supplier = e['supplier'][0];
    let supplierOrderNumber = e['order_number'][0];
    let personReceiving = checkWorkerName(e['name'][0]);
    let storageArea = e['storage_area'][0];
    let contentsCheckedBy = checkWorkerName(e['checked_by'][0]);
    let material_type = e['material_type'][0];
    let notes = e['notes'][0];
    
    const day = receivedDate.getDate();
    const month = receivedDate.getMonth()+1;
    const year = receivedDate.getFullYear();
    const formattedMaterialPlusDate = material_type + "-" + year + (month < 10 ? "0" + month : month) + (day < 10 ? "0" + day : day) + "-" 
    
    // Find the next highest available lot number suffix.
    let values = goodsInSheet.getDataRange().getValues().slice(1);
    var maxLotNumber = 0;
    for (var i = 0; i < values.length; i++) {
      let justTheSuffix = parseInt(values[i][8].replace(formattedMaterialPlusDate, ""));
      if (justTheSuffix > maxLotNumber) {
        maxLotNumber = justTheSuffix;
      }
    }
    const generatedLotnumber = formattedMaterialPlusDate + (maxLotNumber + 1);
    
    goodsInSheet.appendRow([receivedDate, carrier, material, supplier, supplierOrderNumber, personReceiving, storageArea, contentsCheckedBy, generatedLotnumber, notes]);
    
  });
  
  return;
}

/**
 * Append completed (meaning filled in) job card to spreadsheet and return new lot number so it can be displayed to the user.
 */
function appendCompletedJobCard(e) {

  return spreadsheetAccessWithLock(e, function() {

    // Find the next highest available lot number.
    var values = jobLogSheet.getDataRange().getValues().slice(1);
    var maxLotNumber = -1;
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] > maxLotNumber) {
        maxLotNumber = values[i][0];
      }
    }
    var lot_number = maxLotNumber + 1;

    let workstationName = e['workstation'][0];
    let worker = checkWorkerName(e['name'][0]);
    let completion_time = new Date();
    
    var mutable_lot_number_consumed = [e['lot_number_1'][0]];
    if (e['lot_number_1b'] != null && e['lot_number_1b'] != "") {
      mutable_lot_number_consumed.push(e['lot_number_1b'][0]);
    }
    if (e['lot_number_2'] != null && e['lot_number_2'] != "") {
      mutable_lot_number_consumed.push(e['lot_number_2'][0]);
    }
    if (e['lot_number_2b'] != null && e['lot_number_2b'] != "") {
      mutable_lot_number_consumed.push(e['lot_number_2b'][0]);
    }
    if (e['lot_number_3'] != null && e['lot_number_3'] != "") {
      mutable_lot_number_consumed.push(e['lot_number_3'][0]);
    }
    // IMPORTANT: if the delimeter is "," Google Sheets will interpret that as a thousands delimiter - nasty bug!
    let lot_number_consumed = mutable_lot_number_consumed.join(";");
    
    let sealedBoxNumber = e['completed_box_number'] != null ? e['completed_box_number'][0] : null;
    let comment = e['comment'] != null ? e['comment'][0] : null;
    let additional_worker_1 = checkWorkerName(e['additional_worker_1'][0]);
    let additional_worker_2 = checkWorkerName(e['additional_worker_2'][0]);
    
    jobLogSheet.appendRow([lot_number, workstationName, worker, completion_time, lot_number_consumed, sealedBoxNumber, comment, additional_worker_1, additional_worker_2]);
    
    return lot_number;
  });
}

function updateJobCardDetails(e) {

  spreadsheetAccessWithLock(e, function() {

    const jobCardRowNumber = getCellForLotNumber(e['lot_number']);
        
    const target_cell_comment = 'G' + (jobCardRowNumber+1);
    let original_comment = jobLogSheet.getRange(target_cell_comment).getValue();
    let updated_comment = original_comment + "; " + e['comment'];

    jobLogSheet.getRange(target_cell_comment).setValue(updated_comment);

    const target_cell_additional_worker_1 = 'H' + (jobCardRowNumber+1);
    let additional_worker_1 = checkWorkerName(e['additional_worker_1'][0]);
    jobLogSheet.getRange(target_cell_additional_worker_1).setValue(additional_worker_1);
    
    const target_cell_additional_worker_2 = 'I' + (jobCardRowNumber+1);
    let additional_worker_2 = checkWorkerName(e['additional_worker_2'][0]);
    jobLogSheet.getRange(target_cell_additional_worker_2).setValue(additional_worker_2);

    if (e['completed'] != null) {
      const target_cell_completed_time = 'J' + (jobCardRowNumber+1);
      let completed_time = new Date();
      jobLogSheet.getRange(target_cell_completed_time).setValue(completed_time);
    }
    
  });
  
  return;
}

function retireAJobCard(e, retired_by, lot_number, comment) {

  spreadsheetAccessWithLock(e, function() {

    const jobCardRowNumber = getCellForLotNumber(lot_number);
    
    const target_cell_retirement_time = 'K' + (jobCardRowNumber+1);
    let retirement_time = new Date();
    jobLogSheet.getRange(target_cell_retirement_time).setValue(retirement_time);

    const target_cell_retired_by = 'L' + (jobCardRowNumber+1);
    jobLogSheet.getRange(target_cell_retired_by).setValue(retired_by);

    const target_cell_comment = 'G' + (jobCardRowNumber+1);
    let original_comment = jobLogSheet.getRange(target_cell_comment).getValue();
    let updated_comment = original_comment + "; " + comment;
    jobLogSheet.getRange(target_cell_comment).setValue(updated_comment);
    
  });
                            
  return;
}

function retireJobCard(e) {

  let retired_by = e['name'][0];
  let lot_number = e['lot_number_1'][0];
  let comment = e['comment'];
  
  retireAJobCard(e, retired_by, lot_number, comment) 
}

function retireMultipleJobs(e) {
  
  [["retire_lot_number_1", "prefill_lot_number_1"],
   ["retire_lot_number_1b", "prefill_lot_number_1b"],
   ["retire_lot_number_2", "prefill_lot_number_2"],
   ["retire_lot_number_2b", "prefill_lot_number_2b"],
   ["retire_lot_number_3", "prefill_lot_number_3"]].forEach(lot_number_key => {
                                                          
     if (null != e[lot_number_key[0]]) {
       let retired_by = e['prefill_name'][0];
       let lot_number = e[lot_number_key[1]][0];
       let comment = "Auto-retire";
     
       retireAJobCard(e, retired_by, lot_number, comment);
     }
             
  });
}

/**
 * required == true if the drop down should be a required field.
 * only_signed_in = true if only those workers that are signed in for today should be returned.
 * TODO: For now this only lets you signin out once per day; needs a way to tie a sign out to a sign in.
 */
function getListOfWorkerNames(required, only_signed_in) {
  
  let head = (!required ? [default_no_worker_selected] : []);
  
  var listWorkerNames;
  if (!only_signed_in) {
    listWorkerNames = [...( new Set(workersSheet.getDataRange().getValues().slice(1).map(v => (v[1]))))];
  } else {
    let today = new Date();
    today.setHours(0,0,0,0);
    
    // Find all the signins and signouts for today.
    let signedInWorkers = [...( new Set(signinSheet.getDataRange().getValues().slice(1).filter(v => v[0] >= today).map(v => (v[1]))))]
    let signedOutWorkers = [...( new Set(signoutSheet.getDataRange().getValues().slice(1).filter(v => v[0] >= today).map(v => (v[1]))))];
    
    // Discard those sign ins that are signed out.
    // IMPORTANT: This implementation assumes only a single sign-in/out per day.
    listWorkerNames = signedInWorkers.filter(w => !(signedOutWorkers.includes(w)));
  }
    
  return head.concat(listWorkerNames.sort());
}

/**
 * These are the supplier provided numbers; but only the ones that have not yet been completely consumed.
 */
function getListOfGoodsInLotNumbers() {
  let goodsInWithJobCards = jobLogSheet.getDataRange().getValues().slice(1).filter(j => j[1] == 'GoodsIn').map(j => j[4]);
  
  return goodsInSheet.getDataRange().getValues().slice(1).map(j => j[8]).filter(j => !(goodsInWithJobCards.includes(j)));
}

function getGoodsInProcessedLotNumbers(workstationUsingIt) {
  
  // Determine the workstation filter filter to apply.
  // TODO: It should be possible to record this correspondence in the spreadsheet.
  var keywordForGoodsInItem = "NULL";
  if (workstationUsingIt == "CutElastic") {
    keywordForGoodsInItem = "ELASTIC";
  }
  if (workstationUsingIt == "CutFoam") {
    keywordForGoodsInItem = "FOAM";
  }
  if (workstationUsingIt == "LaserCutShield") {
    keywordForGoodsInItem = "PET0";
  }
  if (workstationUsingIt == "QualityControlPassBoxes") {
    keywordForGoodsInItem = "BOX";
  }
  if (workstationUsingIt == "QualityControlPassBags") {
    keywordForGoodsInItem = "SHIPPINGBAGS";
  }
  
  // Get all the job cards.
  // Filter out anything that has a discharged job card. Check lot consumed time.
  return jobLogSheet.getDataRange().getValues().slice(1).filter(j => j[10] == '')
      // Filter out job cards that do not pertain to this workstation.  
      .filter(j => j[1] == 'GoodsIn')
      // Filter out everything except those job cards that the current workstation depends on.
      .filter(j => ("" + j[4]).includes(keywordForGoodsInItem))
      // Format list for output.
      .map(j => j[0])
}

function getUnretiredLotNumbers() {
  // Filter out anything that has a discharged job card. Check lot consumed time. Format list for output.
  return jobLogSheet.getDataRange().getValues().slice(1).filter(j => j[10] == '').map(j => j[0])
}

function getUpstreamLot1Numbers(upstreamWorkstation) {
  // Get all the job cards.
  return jobLogSheet.getDataRange().getValues().slice(1)
         // Filter out anything that has a discharged job card. Check lot consumed time.
         // Filter out job cards that do not pertain to this workstation.  
         .filter(j => j[10] == '' && j[1] == upstreamWorkstation)
         // Format list for output.
         .map(j => j[0])
}

function getJobCardsAsDict() {
  // Get all the job cards. Filter out anything but Boxing job cards and format for display.
  let lots_in_system = jobLogSheet.getDataRange().getValues().slice(1).map(row =>
       ({"lot_no": row[0],
         "workstation": row[1],
         "workers": [row[2], row[7], row[8]],
         "started_time": row[3],
         "completeion_time": row[9],
         "box_number": int_or_none(row[5]),
         "lots_consumed": ("" + row[4]).split(";")})) ;
  
  return lots_in_system;
}
