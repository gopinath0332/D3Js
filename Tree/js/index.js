import * as d3 from "d3";
import $ from "jquery";

import "../css/tree.css";

const [targetNode] = $("#target");
// const targetNode = document.getElementById("target");
var data = {
    "name": "A1",
    "depth": 0,
    "children": [{
        "name": "B1",
    }, {
        "name": "B2",
    }, {
        "name": "B3",
    }, {
        "name": "B4",
    }]
};


class createTree {
    constructor(data) {
        this.nodeGap = 75;
        this.treeData = data;
        this.initTree();
    }
    initTree() {
        try {
            this.svg = d3.select(targetNode).append("svg")
                .attr({
                    "width": 800,
                    "height": 500
                });
            //Create base group for entire treee.
            this.baseGroup = this.svg.append("g")
                .attr("transform", "translate(250,30)scale(1.1)");
            this.tree = d3.layout.tree()
                .nodeSize([100, 70])
                .separation(() => 1);
            this.diagonal = d3.svg.diagonal().projection((d) => [d.x, d.y]);


            data.x0 = 0;
            data.y0 = 0;
            this.root = data;
            this.buildTree(this.root);
        } catch (e) {
            console.error("Error in initialising tree::::", e);
        }
    }
    buildTree(source) {
        try {
            //Calculate the tree layout
            let nodes = this.tree.nodes(source);

            //update fixed depth
            nodes = nodes.map((node) => {
                node.y = (node.depth * 75);
                return node;
            });
            console.debug("source;::::", nodes);
            this.nodes = nodes;

            let node = this.baseGroup.selectAll("g.node").data(nodes, (d, i) => {
                return d.id || (d.id = ++i);
            });

            let groupNode = node.enter().append("g").attr({
                "class": "node",
                "transform": () => {
                    return "translate(" + source.x0 + "," + source.y0 + ")";
                }
            });

            groupNode.append("circle").attr({
                "r": 10
            }).style("fill", "lightblue");

            groupNode.append("text").attr({
                "x": "-10",
                "y": 5,
                "text-anchor": "end",
            }).text((d) => d.name);


            //move nodes to their new position
            let nodeUpdate = node.transition()
                .duration(100)
                .attr("transform", (d) => "translate(" + d.x + "," + d.y + ")");
            //update existing nodes to the parent positions
            let nodeExit = node.exit().transition()
                .duration(100)
                .attr("transform", (d) => "translate(" + source.y + "," + source.x + ")")
                .remove();


            // create links
            let link = this.baseGroup.selectAll("path.link")
                .data(this.tree.links(nodes), (d) => d.target.id);

            link.enter().insert("path", "g").attr({
                    "class": "link",
                    "d": (d) => {
                        var o = {
                            x: source.x0,
                            y: source.yo
                        }
                        return this.diagonal({
                            source: o,
                            target: o
                        });
                    }
                })
                .transition()
                .duration(100)
                .attr("d", this.diagonal);


            // Transition links to their new position.
            link.transition()
                .duration(100)
                .attr("d", this.diagonal);


            // Transition exiting nodes to the parent's new position.
            link.exit().transition()
                .duration(100)
                .attr("d", function(d) {
                    var o = {
                        x: source.x,
                        y: source.y
                    };
                    return this.diagonal({
                        source: o,
                        target: o
                    });
                })
                .remove();

            //Store old node position for transition
            nodes = nodes.map((d) => {
                d.x0 = d.x;
                d.y0 = d.y;
                return d;
            });

        } catch (e) {
            console.error("Error in building tree::::", e);
        }
    }

    insertNodes(parentNode, name) {
        try {
            let nodeJson = {
                "name": "C1"
            };
            let [newNode] = this.tree.nodes(nodeJson);
            console.debug(newNode);
            let [rootNode] = this.nodes;
            rootNode.children.push(newNode);
            this.buildTree(rootNode);

        } catch (e) {
            console.error("Error in updating nodes:::", e);
        }
    }
}


window.obj = new createTree(data);
