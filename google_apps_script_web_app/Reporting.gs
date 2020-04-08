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

function int_or_none(x) {
  var res;
  try {
    res = parseInt(x);
  } catch (e) {
    res = -1;
  }
  return res
}

function getTotalNumberOfLots() {
  return getJobCardsAsDict().filter(j => (j["workstation"] != "Void")).length;
}

function getTotalNumberOfBoxes() {
  return getJobCardsAsDict().filter(j => (j["workstation"] == "Boxing")).length;
}

function reportAllCompletedBoxes() {
  // Filter out anything but Boxing job cards and format for display.
  return getJobCardsAsDict().filter(jc => (jc["workstation"] == "Boxing")).sort(function (a, b) {
    return int_or_none(a["box_number"]) > int_or_none(b["box_number"]);
  });
}

function reportAllLotsOfAffectedWorker(display_tree, symptomatic_worker) {

  // Filter out Void items
  let lots_in_system = getJobCardsAsDict().filter(jc => (jc["workstation"] != "Boxing"));
   
  // Find lots with symptomatic worker.
  
  let symptomatic_worker_lots = lots_in_system.filter(jc => (jc["workers"].include(symptomatic_worker)));
    
  var leaves = [];
    
  function find_next_down_stream_lots(lot) {
    
    // Find all lots that say they were consumed by this one.
    down_stream_lots = lots_in_system.filter(jc => (jc["lots_consumed"].includes(jc["lot_no"])));
    lot["down_stream_lots"] = down_stream_lots;
    if ( down_stream_lots == []) {
      leaves.push(lot)
    }
    down_stream_lots.forEach(s => {s["down_stream_lots"] = find_next_down_stream_lots(s)});
    return down_stream_lots;
  }

  symptomatic_worker_lots.forEach(s => {s["down_stream_lots"] = find_next_down_stream_lots(s)});

  return [leaves, symptomatic_worker_lots];
}

// Do dependency graph stuff.
function dependencyGraph() {
    
    // Filter out Void items. FIXME: Lots consumed might not be right here.
    let nodesInSystem = getJobCardsAsDict().filter(jc => (jc["workstation"] != "Void" && !(""+jc["lots_consumed"]).includes("-")));
        
    // Format nodes for output.
    let my_graph = {
      "nodes": nodesInSystem.map(j => ({ "id": j[0], "name": "" + j[0] + "\n" + j[1] + "\n" + j[2],"group":1})),
      "links": nodesInSystem.map(j => ((""+j[4]).split(";").map(k => ({"source": j[0], "target": parseInt(k), "value":1})))).reduce((acc, curr) => acc.concat(curr))
    };

    return my_graph;
}
