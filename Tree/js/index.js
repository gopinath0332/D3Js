import * as d3 from "d3";
import $ from "jquery";
import Popover from "./popover";
require("bootstrap");

import "bootstrap/dist/css/bootstrap.css";
import "../css/tree.css";

const [targetNode] = $("#target");
const TOPOLOGY_DATA_URL = "../data/mdfdata.xml";
// const targetNode = document.getElementById("target");


class CreateTree {
    constructor(data) {
        this.topologyDataStructure = {};
        this.initTree();
        this.domNode = this.svg;
    }
    initTree() {
        try {
            var margin = {
                    top: 20,
                    right: 10,
                    bottom: 20,
                    left: 10
                },
                width = 100,
                height = 900 - margin.top - margin.bottom;
            this.id = 0;
            // this.tree = d3.layout.tree().size([height, width]);
            this.tree = d3.layout.tree()
                .nodeSize([100, 70])
                .separation(() => 1.3);
            this.root = {
                "name": "Root"
            };
            this.nodes = this.tree(this.root);
            this.root.parent = this.root;
            this.root.x0 = this.root.x;
            this.root.y0 = this.root.y;

            this.diagonal = d3.svg.diagonal();
            this.svg = d3.select(targetNode)
                .append("svg")
                .attr("width", width + "%")
                .attr("height", height);
            let [svgElement] = this.svg[0], [svgDimension] = svgElement.getClientRects();
            this.svg = this.svg.append("g")
                .attr("transform", "translate(" + (svgDimension.width / 2.5) + "," + margin.top + ")");
            // .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            this.node = this.svg.selectAll(".node");
            this.link = this.svg.selectAll(".link");

            this.buildTree();
        } catch (e) {
            console.error("Error in initialising tree::::", e);
        }
    }
    buildTree() {
        try {
            let rectDimension = {
                w: 100,
                h: 40
            };
            let diagonal = d3.svg.diagonal()
                .projection(function(d) {
                    return [d.x + (rectDimension.w / 2), d.y + (rectDimension.h / 2)];
                });
            this.node = this.node.data(this.tree.nodes(this.root), (d, index) => {
                d.y = d.depth * 75;
                return d.id || (d.id = ++this.id);
            });
            this.link = this.link.data(this.tree.links(this.tree.nodes(this.root)), (d) => {
                return d.target.id;
            });

            let groupNode = this.node.enter()
                .append("g")
                .attr({
                    // "class": (d) => d.depth == 0 ? "root" : "node",
                    "class": "node",
                    "id": (d) => d.id,
                    "parent": (d) => d.parent ? d.parent.id : null,
                    "transform": (d) => {
                        return "translate(" + d.x + "," + (d.y) + ")";
                    }
                });
            groupNode.append("rect")
                .attr({
                    "width": rectDimension.w,
                    "height": rectDimension.h,
                    "class": "rect"
                });
            groupNode.append("text")
                .attr({
                    "x": (rectDimension.w / 2),
                    "y": (rectDimension.h / 2),
                    "dy": "0.35em",
                    "text-anchor": "middle"
                        // "dy": (d) => d.children ? "0.35em" : "1.3em",
                        // "text-anchor": (d) => d.children ? "start" : "end"
                })
                .text((d) => {
                    return d.name;
                })
                .style({
                    "font-size": 13
                });

            let toolbarGroup = groupNode.append("g")
                .attr({
                    // "x": (rectDimension.w - 5),
                    // "y": 0,
                    "class": "toolbarGroup",
                    "transform": (d) => {
                        return "translate(" + (rectDimension.w - 20) + "," + 0 + ")"
                    }
                });
            let context = this;
            let add = toolbarGroup.append("image")
                .attr({
                    "xlink:href": "./images/fi-plus.svg",
                    // "x": (rectDimension.w - 5),
                    // "y": -10,
                    "x": 0,
                    "y": 5,
                    "height": 8,
                    "width": 8,
                    "class": "addNode"
                })
                .style("cursor", "pointer")
                .on("click", function(d) {
                    context._appendPopover(this, d);
                });
            toolbarGroup.append("image")
                .attr({
                    "xlink:href": "./images/fi-delete.svg",
                    // "x": (rectDimension.w - 5),
                    // "y": -10,
                    "x": 10,
                    "y": 5,
                    "height": 6,
                    "width": 6,
                    "class": (d) => d.depth == 0 ? "hide" : "removeNode"
                })
                .style("cursor", "pointer")
                .on("click", this.removeNode.bind(this));

            var nodeUpdate = this.node.transition()
                .attr("transform", function(d) {
                    d.y = d.depth * 75;
                    return "translate(" + d.x + "," + d.y + ")";
                });

            // Add entering links in the parent’s old position.
            this.link.enter()
                .insert("path", ".node")
                .attr({
                    "class": "link",
                    "d": this.diagonal.projection((d) => [d.x, d.y])
                });


            //update position of links and nodes to match parents
            let tr = this.svg.transition();
            tr.selectAll(".link")
                .attr("d", this.diagonal.projection((d) => {
                    return [d.x + (rectDimension.w / 2), d.y + (rectDimension.h / 2)]
                }));

            tr.selectAll(".node")
                .attr("transform", (d) => {
                    d.x0 = d.x;
                    d.y0 = d.y;
                    return "translate(" + d.x + "," + d.y + ")";
                });

        } catch (e) {
            console.error("Error in building tree::::", e);
        }
    }

    addNode(parentNode, name, ...params) {

        try {
            // var name = Math.random().toString(36).substring(24);
            if (!name) {
                name = Math.random()
                    .toString(36)
                    .substring(24);
            }
            var newNode = {
                name
            };
            if (!parentNode.children) {
                parentNode.children = [];
            }
            parentNode.children.push(newNode);
            this.buildTree();
        } catch (e) {
            console.error("Error in updating nodes:::", e);
        }
    }

    removeNode(deleteNode, ...params) {
        try {
            // console.debug(arguments);
            //remove nodes
            let nodes = this.tree.nodes(deleteNode);
            if (nodes.length) {
                this.svg.selectAll("g.node")
                    .data(nodes, (d) => {
                        return d.id;
                    })
                    .remove();
            }
            //remove links
            let links = this.tree.links(nodes);
            if (links) {
                this.svg.selectAll("path.link")
                    .data(links, (d) => {
                        return d.target.id;
                    })
                    .remove();
            }
            //remvoe links to parent
            this.svg.selectAll("path.link")
                .filter((d) => {
                    return d.target.id == deleteNode.id ? true : false;
                })
                .remove();
            // remove node from tree heirarchy
            let parent = deleteNode.parent;
            parent.children.map((d) => {
                if (d.id == deleteNode.id) {
                    parent.children.splice(d, 1);
                }
            });
        } catch (e) {
            console.error("Error in removing node:::", e);
        }
    }
    _appendPopover(image, nodeObj) {
        new Popover(this, image, nodeObj);
    }
}


window.obj = new CreateTree();
