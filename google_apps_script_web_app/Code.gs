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

/**
 * For the drop downs we wish to avoid the first item being selected as default by ensuring one has to be actively selected.
 */
function checkWorkerName(workNameToCheck) {
  if (workNameToCheck == null || workNameToCheck == default_no_worker_selected) {
    return null;
  } else {
    return workNameToCheck;
  }
}

// The following few functions provide a way of allowing us to render pages since Google Apps Scripts doesn't provide proper routing.

function checkNoParameters(e) {
  return (null == e["parameters"]) || (0 == Object.keys(e["parameters"]).length);
}

function checkOnlyWorkstationPresent(e) {
  return (1 == Object.keys(e["parameters"]).length) && (e["parameters"]["workstation"] != null);
}

function checkJobCardPresent(e) {
  return (e["parameters"]["workstation"] != null) &&
    (e["parameters"]["name"] != null) &&
      // The job card might have more than one dependent lot but at least one is required.
      (e["parameters"]["lot_number_1"] != null) && 
       (e["parameters"]["workstation"] != "RetireJobCard") &&
         ((e["parameters"]["task"] == null) 
          || (e["parameters"]["task"] != "autoRetireLotCard"));
}

function checkIsWorkerPage(e) {
  return (e["parameters"]["workstation"] != null) &&
    ((e["parameters"]["workstation"] == "WorkerRegistration") ||
    (e["parameters"]["workstation"] == "WorkerSignIn") ||
      (e["parameters"]["workstation"] == "WorkerSignOut"));
}

function checkIsJobCardReceiptPage(e) {
  return (e["parameters"]["task"] != null) &&
    (e["parameters"]["task"] == "completedJobCard") &&
    (e["parameters"]["lot_number"] != null) &&
      (e["parameters"]["comment"] != null);
}

function checkIsRetireMultipleJobCardPage(e) {
  return (e["parameters"]["task"] != null) &&
    (e["parameters"]["task"] == "autoRetireLotCard");
}

function checkIsGoodsInReceivedPage(e) {
  // TODO: Make this check more robust.
  return (e["parameters"]["material_type"] != null);
}

function checkIsJobCardRetirePage(e) {
  return (e["parameters"]["workstation"] == "RetireJobCard");
}

function checkIsDashboard(e) {
  return (prefilledValues["dashboard"] != null);
}

function getScriptUrl() {
 return ScriptApp.getService().getUrl();
}

// These values need to be filled in since they get picked up by the template.
var taskToDisplay;
var workstationToDisplay;
var completedJobCardLotNumber;
var completedJobCardDetails;
var prefilledValues;
var totalNumberOfLots;
var totalNumberOfBoxes;

function doGet(e) {

  console.log("Handling GET ...");
  console.log("Parameters:" + JSON.stringify(e['parameters']));

  prefilledValues = e['parameters'];
  totalNumberOfLots = getTotalNumberOfLots();
  totalNumberOfBoxes = getTotalNumberOfBoxes();
  
  // If there are no parameters then serve the default webpage that asks the user to select the workstation type.
  if (checkNoParameters(e)) {
    // Just show the home page.
    taskToDisplay = "homepage";
    
    return HtmlService.createTemplateFromFile('Index').evaluate();  
  }

  // For now the dashboard is outside the main system.
  if (checkIsDashboard(e)) {
      return HtmlService.createTemplateFromFile('Dashboard').evaluate();  
  }

  // If a workstation type is present, both nothing else serve that form and ignore everything else.
  if (checkOnlyWorkstationPresent(e)) {  
    taskToDisplay = "jobCard";
    workstationToDisplay = e['parameters']['workstation'];
    
    console.log("Only workstation in parameters so serving workstation " + workstationToDisplay + "...");
    
    return HtmlService.createTemplateFromFile('Index').evaluate();  
  }

  if (checkIsWorkerPage(e)) {
    appendWorkerDetails(e["parameters"]);
    
    taskToDisplay = "homepage";
    
    return HtmlService.createTemplateFromFile('Index').evaluate();  
  }

  if (checkIsGoodsInReceivedPage(e)) {
    appendCompletedGoodsIn(e['parameters']);
    
    taskToDisplay = "jobCard";
    workstationToDisplay = "GoodsIn";
    
    return HtmlService.createTemplateFromFile('Index').evaluate();  
  }
  
  // If a completed job card is given then determine the new lot number and write the completed job out to the
  // database and serve the job number together with a link to restart job card.  
  if (checkJobCardPresent(e)) {
    completedJobCardLotNumber = appendCompletedJobCard(e["parameters"]);
    console.log("completedJobCardLotNumber: " + completedJobCardLotNumber);
    
    if (-1 == completedJobCardLotNumber) {
      // For now this stands for an error condition.
      taskToDisplay = "lotNumberAlreadyConsumed";
    } else {
      completedJobCardDetails = e["parameters"];
      workstationToDisplay = e['parameters']['workstation'];
      
      // For Goods In there is nothing consumed so no need to ask user what needs retiring.
      if (workstationToDisplay != "GoodsIn") {
        taskToDisplay = "autoRetireLotCard";
      } else {
        taskToDisplay = "completedJobCard";
      }
    }
    
    return HtmlService.createTemplateFromFile('Index').evaluate();  
  }
  
  if (checkIsRetireMultipleJobCardPage(e)) {
    
    console.log("IsRetireMultipleJobCardPage");

    retireMultipleJobs(e['parameters'])
    
    completedJobCardDetails = e["parameters"];          
    completedJobCardLotNumber = e["parameters"]["lot_number"];
    
    taskToDisplay = "completedJobCard";
    workstationToDisplay = e['parameters']['workstation'];
    
    return HtmlService.createTemplateFromFile('Index').evaluate();  
  }

  if (checkIsJobCardReceiptPage(e)) {
    
    updateJobCardDetails(e["parameters"]);
    
    completedJobCardDetails = e["parameters"];          
    completedJobCardLotNumber = e["parameters"]["lot_number"];
    
    if (e['parameters']['completed'] != null) {
      // On to the next job card for this workstation.
      taskToDisplay = "jobCard";
    } else {
      // Allow for more changes to this incomplete lot card.
      taskToDisplay = "completedJobCard";
    }
    workstationToDisplay = e['parameters']['workstation'];
    
    return HtmlService.createTemplateFromFile('Index').evaluate();  
  }

  if (checkIsJobCardRetirePage(e)) {
    retireJobCard(e["parameters"]);
    taskToDisplay = "homepage";
    
    return HtmlService.createTemplateFromFile('Index').evaluate();  
  }
  
  console.error("Fell through so will serve homepage...");
  taskToDisplay = "homepage";
  
  return HtmlService.createTemplateFromFile('Index').evaluate();  
}