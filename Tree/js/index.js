import * as d3 from "d3";
import $ from "jquery";

import "../css/tree.css";

const [targetNode] = $("#target");
// const targetNode = document.getElementById("target");

class createTree {
    constructor(data) {
        this.initTree();
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
                height = 600 - margin.top - margin.bottom;
            this.id = 0;
            this.tree = d3.layout.tree().size([height, width]);
            this.root = {
                "name": "Root"
            };
            this.nodes = this.tree(this.root);
            this.root.parent = this.root;
            this.root.x0 = this.root.x;
            this.root.y0 = this.root.y;

            this.diagonal = d3.svg.diagonal();
            this.svg = d3.select(targetNode).append("svg")
                .attr("width", width + "%")
                .attr("height", height)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            this.node = this.svg.selectAll(".node");
            this.link = this.svg.selectAll(".link");

            this.buildTree();
        } catch (e) {
            console.error("Error in initialising tree::::", e);
        }
    }
    buildTree(source) {
        try {
            let diagonal = d3.svg.diagonal()
                .projection(function(d) {
                    return [d.x, d.y];
                });
            this.node = this.node.data(this.tree.nodes(this.root), (d, index) => {
                d.y = d.depth * 75;
                return d.id || (d.id = ++this.id);
            });
            // this.link = this.link.data(this.tree.links(this.nodes), (d) => {
            //     return d.target.id;
            // });
            // console.debug(this.node);
            this.link = this.link.data(this.tree.links(this.tree.nodes(this.root)), (d) => {
                return d.target.id;
            });

            let groupNode = this.node.enter().append("g")
                .attr({
                    // "class": (d) => d.depth == 0 ? "root" : "node",
                    "class": "node",
                    "id": (d) => d.id,
                    "parent": (d) => d.parent ? d.parent.id : null,
                    "transform": (d) => {
                        return "translate(" + d.x + "," + (d.y) + ")"
                    }
                });
            groupNode.append("circle")
                .attr({
                    "class": "circle",
                    "r": 10,
                }).style({
                    "fill": "slategrey",
                    "cursor": "pointer"
                }).on("click", this.addNode.bind(this));
            groupNode.append("text")
                .attr({
                    "x": 13,
                    "dy": "0.75em",
                    "text-anchor": "start"
                        // "dy": (d) => d.children ? "0.35em" : "1.3em",
                        // "text-anchor": (d) => d.children ? "start" : "end"
                })
                .text((d) => {
                    return d.name;
                })
                .style({
                    "font-size": 13
                });
            groupNode.append("image")
                .attr({
                    "xlink:href": "./images/fi-delete.svg",
                    "x": 15,
                    "y": -10,
                    "height": 7,
                    "width": 7,
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
            this.link.enter().insert("path", ".node")
                .attr({
                    "class": "link",
                    "d": this.diagonal.projection((d) => [d.x, d.y])
                });

            let tr = this.svg.transition();
            tr.selectAll(".link").attr("d", this.diagonal.projection((d) => {
                return [d.x, d.y]
            }));

            tr.selectAll(".node").attr("transform", (d) => {
                d.x0 = d.x;
                d.y0 = d.y;
                return "translate(" + d.x + "," + d.y + ")";
            });

        } catch (e) {
            console.error("Error in building tree::::", e);
        }
    }

    addNode(parentNode, ...params) {
        try {
            // console.debug(parentNode, params);
            var name = Math.random().toString(36).substring(24);
            if (!name) {
                name = Math.random().toString(36).substring(24);
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
                this.svg.selectAll("g.node").data(nodes, (d) => {
                    return d.id;
                }).remove();
            }
            //remove links
            let links = this.tree.links(nodes);
            if (links) {
                this.svg.selectAll("path.link").data(links, (d) => {
                    return d.target.id;
                }).remove();
            }
            //remvoe links to parent
            this.svg.selectAll("path.link").filter((d) => {
                return d.target.id == deleteNode.id ? true : false;
            }).remove();
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
}


window.obj = new createTree();
