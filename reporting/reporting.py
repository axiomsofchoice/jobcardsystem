"""
Cambridge Makespace COVID-19 Visor Tracability Workflow
=======================================================

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

"""

import csv
from functools import reduce
from graphviz import Digraph
import pprint
import argparse

pp = pprint.PrettyPrinter(indent=2)

parser = argparse.ArgumentParser(description='Reporting of production data, based on job cards.')
# Download the "JobLog" sheet from the Google Sheets spreadsheet.
parser.add_argument('--csv', dest='spreadsheet', action='store', required=True,
                    help='Path to CSV file downloaded from Google Sheets')
parser.add_argument('--out', dest='outfile', action='store', required=False,
                    help='Path to network graph output file')
parser.add_argument('--exclude', dest='exclude', action='store', required=False,
                    help="Comma-separated list of workstation IDs to filter.")
parser.add_argument('--sanity', dest='sanity', action='store_true', required=False,
                    help="Find all the lots that have inconsistent upstream lot numbers for their type.")
parser.add_argument('--graph', dest='do_graph', action='store_true', required=False,
                    help='Output dependency network graph')
parser.add_argument('--wip', dest='wip', action='store_true', required=False,
                    help="Print out details of in-flight lots.")
parser.add_argument('--boxes', dest='boxes', action='store_true', required=False,
                    help="Print out details of just the completed boxes, in box number order.")
parser.add_argument('--consumed', dest='consumed', action='store_true', required=False,
                    help="Print out details of lots that consumed each of the raw materials from Goods In.")
parser.add_argument('--details', dest='all_details', action='store_true', required=False,
                    help="Print all details; to be used in conjunction with --consumed.")
parser.add_argument('--worker', dest='symptomatic_worker', action='store',
                    help='Prints out a tree of all boxes that include parts touched by symptomatic worker; argument requires name of symptomatic worker')
parser.add_argument('-l', dest='leaves', action='store_true',
                    help='To be used with --worker. Print only the leaves of the tree plus a total count; otherwise the whole tree is printed')
args = parser.parse_args()

# Dependencies between the different job cards.
dependencies = {
    'Void': [],
    'GoodsIn': [],
    'LaserCutShield': ['GoodsIn'],
    'CutFoam': ['GoodsIn'],
    'CutElastic': ['GoodsIn'],
    'StickFoamToShield': ['CutFoam', 'LaserCutShield'],
    'StapleElasticToShield': ['CutElastic', 'StickFoamToShield'],
    'QualityControlPass': ['StapleElasticToShield', 'GoodsIn'],
    'QualityControlFail': ['StapleElasticToShield'],
    'Boxing': ['QualityControlPass'],
    'GoodsOut': ['Boxing'],
}

def _int_or_none(x):
    """Parse strings to ints with sensible default if this is not possible.
    """
    try:
        res = int(x)
    except:
        res = -1
    return res

def do_print_wip(lots_in_system):

    filtered_lots = [l for l in lots_in_system if l["retired_time"] == ""]
    # Group by workstation.
    for lot in sorted(filtered_lots, key=lambda l: l["workstation"]):
        pp.pprint(lot)
        print()
        
    print("\nNumber of WIP lots: %d" % len(filtered_lots))

def do_print_completed_boxes(lots_in_system):

    filtered_lots = [l for l in lots_in_system if l["workstation"] == "Boxing"]
    # Group by workstation.
    for lot in sorted(filtered_lots, key=lambda l: l["box_number"]):
        pp.pprint(lot)
        print()
        
    print("\nNumber of completed boxes: %d" % len(filtered_lots))

def _find_next_down_stream_lots(lots_in_system, lot, leaves):
    """Find all lots that say they were consumed by this one.
    
    leaves - an array of leaves of tree to be appended to
    """
    
    down_stream_lots = [l for l in lots_in_system if lot["lot_no"] in l["lots_consumed"]]
    lot["down_stream_lots"] = down_stream_lots
    if down_stream_lots == []:
        leaves.append(lot)
    for d in down_stream_lots:
        _find_next_down_stream_lots(lots_in_system, d, leaves)
    return down_stream_lots
    
def do_find_lots_affected_by_symptomatic_worker(lots_in_system, symptomatic_worker, just_leaves):
    """Find lots with symptomatic worker.
    """
    
    symptomatic_worker_lots = [l for l in lots_in_system if (symptomatic_worker in l["workers"]) ]
    
    leaves = []
    
    for s in symptomatic_worker_lots:
        s["down_stream_lots"] = _find_next_down_stream_lots(lots_in_system, s, leaves)

    if just_leaves:
        for lot in sorted(leaves, key=lambda l: l["workstation"]):
            # Just print the leaves of the tree.
            pp.pprint(lot)
            print()
        print("\nNumber of lots: %d" % len(leaves))
    else:
        # Print the whole tree.
        pp.pprint(symptomatic_worker_lots)

def do_get_raw_material_usage(lots_in_system, print_all):

    # The following are the downstream workstations from "GoodsIn".
    consuming_workstations = [('LaserCutShield', "PET"),
                              ('CutFoam', "FOAM"),
                              ('CutElastic', "ELASTIC"),
                              # QualityControlPass consumes both the shipping bags and boxes
                              ('QualityControlPass', "SHIPPINGBAG"),
                              ('QualityControlPass', "BOX")]

    # Find all the "GoodsIn" lots for the consuming workstations.
    for w in consuming_workstations:
        raw_lots = [l for l in lots_in_system if l["workstation"] == "GoodsIn"
                                            and w[1] in str(l["lots_consumed"])]
                                             
        for r in raw_lots:
                
            lots_that_consume_raw = [l for l in lots_in_system if
                                         str(r["lot_no"]) in l["lots_consumed"]]
            
            if print_all:
                for lot in sorted(lots_that_consume_raw, key=lambda l: l["lot_no"]):
                    pp.pprint(lot)
                    print()
            
            print("\nNumber of %s lots from %s (%s): %d" % (w[0], r["lot_no"],
                str(r["lots_consumed"]), len(lots_that_consume_raw)))

def _get_lot_detail_from_lot_number(lots_in_system, lot_number):
    for l in lots_in_system:
        if lot_number == l["lot_no"]:
            return l
    raise Exception("Could not find row for: %s" % lot_number)

def do_sanity_check_dependency_graph(lots_in_system):
    """Ensure that up stream lots are consistent with what they should be.
    """
    
    for l in lots_in_system:
        # Filter out lots that don't have dependencies.
        if l["workstation"] in ['Void', 'GoodsIn']:
            continue
        
        dependency_types_of_this_lot = set([_get_lot_detail_from_lot_number(lots_in_system, dep)["workstation"] for dep in l["lots_consumed"]])
        expected_dependency_types = set(dependencies[l["workstation"]])
        if (dependency_types_of_this_lot ^ expected_dependency_types) != set():
            # Perform and soft inclusion check QualityControlPass
            # Note: this allows for self-references due to the "spares" box.
            if l["workstation"] == "QualityControlPass" and \
                (dependency_types_of_this_lot ^ expected_dependency_types) == set(["QualityControlPass"]):
                continue

            print(repr(l), dependency_types_of_this_lot, expected_dependency_types)

def do_network_graph(lots_in_system, outfile):
    """Creates a network graph of dependencies between job cards.
    """
    dot = Digraph(comment='Job Cards')

    # Generally these graphs work well if the following are excluded:
    exclude = ["GoodsIn", "Void"]

    nodes_in_system = [l for l in lots_in_system if not(l["workstation"] in exclude)
                                          and not ("-" in str(l["lots_consumed"]))]

    # See: https://www.graphviz.org/doc/info/colors.html
    colour_scheme = { "GoodsIn": 'darkseagreen',
                      "LaserCutShield": 'darkseagreen1',
                      "CutFoam": 'darkseagreen2',
                      "CutElastic": 'darkseagreen3',
                      "StapleElasticToShield": 'darkseagreen4',
                      "StickFoamToShield": 'aquamarine',
                      "QualityControlPass": 'aquamarine1',
                      "QualityControlFail": 'aquamarine2',
                      "Boxing": 'aquamarine3',
                      "GoodsOut": 'aquamarine4'
    }

    # Format nodes for output.
    for node in nodes_in_system:
        label =  "" + node["lot_no"] + "\n" + node["workstation"] + "\n" + node["workers"][0]
        if node["workstation"] in colour_scheme.keys():
            dot.attr('node', style='filled', color=colour_scheme[node["workstation"]])
        else:
            dot.attr('node', style='filled', color='white')
        dot.node(node["lot_no"], label)

    for l in reduce((lambda a, c: a + c), [[[node["lot_no"], target] for
                 target in node["lots_consumed"]] for node in nodes_in_system]):
        print(l)
        dot.edge(l[0], l[1], "")

    # "neato" is another good option here.
    dot.engine = "sfdp"
    dot.attr(overlap='false')
    # Using splines would be easier to follow but it requires a lot of processing.
    #dot.attr(splines="true")
    dot.render(outfile+".gv", view=True)

if __name__ == "__main__":
    
    with open(args.spreadsheet) as csvfile:
        my_rows = []
        for row in csv.reader(csvfile, delimiter=',', quotechar='\"'):
            my_rows.append(row)
            
        exclusions = ["Void"]
        if args.exclude is not None:
            exclusions = exclusions + args.exclude.split(",")
        
        # Read in all lots and .
        lots_in_system = [{"lot_no": row[0],
                            "workstation": row[1],
                            "workers": [row[2], row[7], row[8]],
                            "started_time": row[3],
                            "completeion_time": row[9],
                            "retired_time": row[10],
                            "box_number": _int_or_none(row[5]),
                            "lots_consumed": row[4].split(";")} 
                               for row in my_rows[1:]
                            if not(row[1] in exclusions)]
                   
        if args.wip:
            do_print_wip(lots_in_system)
    
        if args.boxes:
            do_print_completed_boxes(lots_in_system)
            
        if args.symptomatic_worker is not None:
            do_find_lots_affected_by_symptomatic_worker(lots_in_system,
                                                        args.symptomatic_worker,
                                                        args.leaves)
        if args.sanity:
            do_sanity_check_dependency_graph(lots_in_system)
            
        if args.consumed:
            do_get_raw_material_usage(lots_in_system, args.all_details)
            
        if args.do_graph:
            do_network_graph(lots_in_system, args.outfile)
