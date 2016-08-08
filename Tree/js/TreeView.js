/*
 *Tree view implementation
 */
dojo.provide("ifm.guided.workflow.wirelessview.TreeView");

dojo.require("dijit._Widget");
dojo.require("dijit._Templated");
dojo.require("xwt.widget.notification.ValidationTextBox");
dojo.require("xwt.widget.layout.Popover");
dojo.require("xwt.widget.notification.Alert");
dojo.require("ifm.guided.workflow.wirelessview.WirelessUtil");
dojo.declare("ifm.guided.workflow.wirelessview.TreeView", [dijit._Widget], {
    tree: null,
    root: null,
    nodes: null,
    links: null,
    maxLabelLength: null,
    svg: null,
    svgGroup: null,
    zoomListener: null,
    totalNodes: 0,
    panBoundary: 20, //20px from edges will pan when dragging.
    panSpeed: 200,
    duration: 750,
    draggingNode: null,
    selectedNode: null,
    nodeCount: 0,
    dataUrl: null,
    json: null,
    targetDevices: null,
    style: null,
    width: 900,
    height: 400,
    baseNode: null,
    siteName: null,
    _spgPopover: null,
    _colideNode: null,
    _deleted_controllers: "",
    _deleted_spgs: "",
    _deleted_agents: "",
    _deletedDevices: [],
    _errorMsg: "",
    _groupErrorMsg: "",
    _mobilityGroupList: [],
    _dragDistance: 0,
    _setDataUrlAttr: function(url) {
        var context = this;
        var xhrArgs = {
            postData: dojo.toJson(this.targetDevices),
            url: url,
            sync: true,
            preventCache: false,
            headers: {
                "Content-Type": "application/json"
            },
            handleAs: "json",
            load: function(response) {
                context.json = response;
            },
            error: function(error) {
                console.error("Error while getting MobilityControllers: ", error);
            }
        };
        return dojo.xhrPost(xhrArgs);
    },
    postCreate: function() {
        this.wirelessUtil = new ifm.guided.workflow.wirelessview.WirelessUtil({});
        this.i18nMsg = this.wirelessUtil.i18nMsg;
        this._errorMsg = this.i18nMsg["create_group_error"];
        this._groupErrorMsg = this.i18nMsg["create_group_error1"];

        this._deletedDevices = [];
        var root = this.convertArchToD3Json();
        root.x0 = 20;
        root.y0 = 0;
        var baseDiv = document.createElement("div");
        baseDiv.id = "container";
        baseDiv.style.width = this.width + "px";
        baseDiv.style.height = this.height + "px";
        var currentContext = this;
        var description = this.i18nMsg["create_group_desc2"];
        var titleGroup = d3.select(baseDiv).append("div");
        titleGroup.append("div").html(this.i18nMsg["create_group_label"]).attr("class", "groupTitle");
        var name = titleGroup.append("div").attr("class", "domainValueField").text(this.i18nMsg["create_group_mobility_name"]);
        var nameContainer = name.append("span")
            .attr("class", "siteName");
        nameContainer.append("span")
            // .text(root.name);
            .text(function() {
                var name = "";
                if (currentContext.siteName) {
                    name = currentContext.siteName;
                    root.name = currentContext.siteName;
                } else {
                    name = root.name;
                }
                return name;
            });
        titleGroup.append("div").text(description).attr("class", "mobilityDescription");

        var baseSvg = d3.select(baseDiv).append("svg").attr({
            width: currentContext.width,
            height: currentContext.height,
            "class": "overlay"
        });
        var baseGroup = baseSvg.append("g")
            .attr("transform", "translate(444,30)scale(1.1)")
            .attr("class", "baseGroup");
        this.svgGroup = baseGroup;
        // Define zoom behavior for base group
        var zoom = d3.behavior.zoom()
            .scale(1)
            .scaleExtent([0.9, 3])
            .on("zoom", function() {
                //Work around for popover inside svg element issue.
                if ((currentContext._spgPopover && currentContext._spgPopover.isShowingNow) || (dojo.byId("ieEdit"))) {
                    return;
                }
                var mouseCoordinates = d3.mouse(d3.select("svg").node()), // Calcuate mouse co ordinate to get x-axi since event translate starts from [0,0]
                    translate = d3.event.translate; //  Calculate the transform values to get y axis.
                var x = 440; // default value.
                var translateCoords = d3.transform(baseGroup.attr("transform"));
                if (!currentContext._dragDistance) {
                    currentContext._dragDistance = mouseCoordinates[0] - translateCoords.translate[0];
                }
                if (currentContext._dragDistance > 0) {
                    x = mouseCoordinates[0] - currentContext._dragDistance;
                } else {
                    var distance = Math.abs(currentContext._dragDistance);
                    x = mouseCoordinates[0] + distance;
                }
                baseGroup.attr("transform", "translate(" + [x, translate[1]] + ")scale(" + d3.event.scale + ")");
            });
        this.zoomListener = zoom;
        var svgDrag = d3.behavior.drag().on("dragend", function() {
            currentContext._dragDistance = 0;
            currentContext.checkView();
        });

        baseSvg.call(zoom);
        baseSvg.call(svgDrag);
        this.tree = d3.layout.tree()
            .nodeSize([100, 70]) // if nodeSize and sepration defined, dont use size api to alter the node size and vice versa
            .separation(function() {
                return 1;
            });
        this.sortTree();
        this.root = root;
        var tmpNode = this.tree.nodes(root);
        this.help(tmpNode);
        this.udpateNodes(root, baseGroup);
        this.svg = baseSvg;
        this.baseNode = baseDiv;
        d3.selectAll("div.dijitInline button").on("click", function() {
            if (currentContext._spgPopover) {
                currentContext._spgPopover.destroyRecursive();
            }
        });
        var targetViewId = dijit.byId('com_cisco_xmp_web_page_create_guided_workflow').viewIdList.target_devices,
            targetViewObj = dijit.byId(targetViewId),
            mobilityGroupStore = targetViewObj.mobilityGroupComboBox.store;
        mobilityGroupStore.fetch({
            onComplete: function(items) {
                for (var i = 0; i < items.length; i++) {
                    currentContext._mobilityGroupList.push(items[i].name[0].toLowerCase());
                }
            }
        });

        d3.selection.prototype.position = function() {

            var el = this.node();
            var elPos = el.getBoundingClientRect();

            function getVpPos(el) {
                if (el.parentElement.tagName === 'svg') {
                    return el.parentElement.getBoundingClientRect();
                }
                return getVpPos(el.parentElement);
            }

            var vpPos = getVpPos(el);
            return {
                top: elPos.top - vpPos.top,
                left: elPos.left - vpPos.left,
                width: elPos.width,
                bottom: elPos.bottom - vpPos.top,
                height: elPos.height,
                right: elPos.right - vpPos.left
            };

        };
    },
    /**
     * Check if the heirarchy is in view port. if no, reset the heirarchy to initial position .
     */
    checkView: function() {
        var offset = d3.select(".baseGroup").position(),
            groupNodeOffset = d3.select(".baseGroup").node().getBBox();
        if (offset.left < 0 && (Math.abs(offset.left) > (offset.width - 30))) { // left drag.
            this.resetView();
        }
        if (offset.top < 0 && (Math.abs(offset.top) > offset.height)) { // top drag.
            this.resetView();
        }
        if (offset.top > 0 && (offset.top > this.height)) { // bottom drag.
            this.resetView();
        }
        if (offset.right > 0 && (offset.right - offset.width) > this.width) { // right drag
            this.resetView();
        }
    },
    /**
     * reset heirarchy if it is out of view port.
     */
    resetView: function() {
        var context = this;
        setTimeout(function() {
            d3.select(".baseGroup").transition()
                .duration(context.duration)
                .attr("transform", "translate(444,30)scale(1.1)");
            var zoomListener = context.zoomListener;
            zoomListener.scale(zoomListener.scale());
            zoomListener.translate([444, 30]);
        }, 1500);
    },
    /*
     * method to update nodes position and tree strucutre
     */
    udpateNodes: function(data, canvas) {
        var root = this.root;
        var currentContext = this;
        var treeInstance = this.tree;
        var levelWidth = [1];
        var childCount = function(level, n) {
            if (n.children && n.children.length > 0) {
                if (levelWidth.length <= level + 1) {
                    levelWidth.push(0);
                }
                levelWidth[level + 1] += n.children.length;
                n.children.forEach(function(d) {
                    childCount(level + 1, d);
                });
            }
        };
        childCount(0, root);
        var nodes = this.nodes = treeInstance.nodes(root).reverse();
        this.links = this.tree.links(this.nodes);
        var labelLength = this.maxLabelLength;
        var dragginNodes = null;
        var nodeDepth = null;
        var dragListener = d3.behavior.drag()
            .on("dragstart", function(node) {
                nodeDepth = node.depth;
                if (node === currentContext.root || (nodeDepth == 1 && node.children !== undefined && node.children.length > 0) || d3.select(this).select(".fObject").node() || d3.select(this).classed("nodeDelete") || (currentContext._spgPopover && currentContext._spgPopover.isShowingNow)) { // controller node with  children is not allowd to move.
                    return;
                }
                dragginNodes = treeInstance.nodes(node);
                d3.select(".templink").remove();
                d3.event.sourceEvent.stopPropagation();
            })
            .on("drag", function(d) {
                if (d === currentContext.root || (nodeDepth == 1 && d.children !== undefined && d.children.length > 0) || d3.select(this).select(".fObject").node() || d3.select(this).classed("nodeDelete") || (currentContext._spgPopover && currentContext._spgPopover.isShowingNow)) {
                    return;
                }
                currentContext.initDrag(d, this, dragginNodes);
                currentContext.noDrop(d, this, nodeDepth);

                var svgElem = d3.select("svg")[0][0],
                    svgPosition = dojo.position(svgElem),
                    relCoords = d3.mouse(svgElem);
                if (relCoords[0] < currentContext.panBoundary) {
                    currentContext.pan(this, "left");
                } else if (relCoords[0] > (svgPosition.w - currentContext.panBoundary)) {
                    currentContext.pan(this, "right");
                } else if (relCoords[1] < currentContext.panBoundary) {
                    currentContext.pan(this, "up");
                } else if (relCoords[1] > (svgPosition.h - currentContext.panBoundary)) {
                    currentContext.pan(this, "down");
                }
                d.x0 += d3.event.dx;
                d.y0 += d3.event.dy;
                d3.select(this).attr("transform", function(d) {
                    return "translate(" + [d.x0, d.y0] + ")";
                });
                currentContext.updateTempConnector();
            }).on("dragend", function(node) {
                if (node === currentContext.root || (nodeDepth == 1 && node.children !== undefined && node.children.length > 0) || d3.select(this).select(".fObject").node() || d3.select(this).classed("nodeDelete") || (currentContext._spgPopover && currentContext._spgPopover.isShowingNow)) {
                    return;
                }
                var selectedNode = currentContext.selectedNode;
                if (selectedNode) {
                    var draggingNode = currentContext.draggingNode;
                    if (draggingNode.preDeployed) {
                        currentContext.getDeleteExpression(draggingNode); // Update delete expression before updating new dragging position.
                    }
                    node.preDeployed = false; // Make predeployed to false, if device moved to new position.
                    // Remove element from the parent, and insert it into the new elements children
                    var index = draggingNode.parent.children.indexOf(draggingNode);
                    if (index > -1) {
                        draggingNode.parent.children.splice(index, 1);
                    }
                    if (typeof selectedNode.children !== "undefined" || typeof selectedNode._children !== "undefined") {
                        if (typeof selectedNode.children !== "undefined") {
                            selectedNode.children.push(draggingNode);
                        } else {
                            selectedNode._children.push(draggingNode);
                        }
                    } else {
                        selectedNode.children = [];
                        selectedNode.children.push(draggingNode);
                    }
                    currentContext.expand(selectedNode);
                    currentContext.sortTree();
                    currentContext.endDrag(node, this);
                } else {
                    currentContext.endDrag(node, this);
                }
                d3.select(".templink").remove();
            });
        nodes.forEach(function(d) {
            // d.y = (d.depth * (labelLength * 5));
            //Calculate depth/distance between nodes vertically
            d.y = (d.depth * 75); // Max depth distance to make sure tree fit in visible area.
        });
        // create group node
        var nodeEnt = canvas.selectAll("g.node").data(nodes, function(d) {
            return d.id || (d.id = ++currentContext.nodeCount);
        });
        var gnode = nodeEnt.enter().append("g")
            .call(dragListener)
            .attr({
                "class": function(d) {
                    var name = "node";
                    if (d.depth === 0) {
                        name += " root";
                    }
                    return name;
                },
                transform: function() {
                    return "translate(" + data.x + "," + data.y + ")";
                }
            }).on("mouseover", function() {
                if (!d3.select(this).select(".ghostCircle").classed("show")) {
                    d3.select(this).select(".selectCircle").classed("show", true);
                }
            }).on("mouseout", function() {
                var gnode = d3.select(this);
                gnode.select(".selectCircle").classed("show", false);
            });

        var diagonal = d3.svg.diagonal()
            .projection(function(d) {
                return [d.x, d.y];
            });
        //create path
        var link = canvas.selectAll("path.link")
            .data(this.links, function(d) {
                return d.target.id;
            });
        link.enter().insert("path", "g").attr({
            "class": "link",
            "fill": "none",
            "stroke": "grey"
        }).attr("d", function() {
            var o = {
                x: data.x0,
                y: data.y0
            };
            return diagonal({
                source: o,
                target: o
            });
        });

        link.transition()
            .duration(currentContext.duration)
            .attr("d", diagonal);
        link.exit()
            .transition()
            .duration(currentContext.duration)
            .attr("d", function() {
                var o = {
                    x: data.x,
                    y: data.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            }).remove();

        // Create text node
        gnode.append("text").style("font-size", "11px")
            .attr({
                x: function(d) {
                    if (d.name.length < 10) {
                        return -10;
                    }
                    return d.children || d._children ? -10 : -40;
                },
                "text-anchor": function(d) {
                    return d.children || d._children ? "end" : "start";
                },
                y: function(d) {
                    return d.children || d._children ? -5 : 15;
                },
                "dy": ".75em",
                "class": "nodeText"
            })
            .text(function(d) {
                var name = "";
                if (d.depth === 0 && currentContext.siteName) {
                    name = currentContext.siteName;
                } else {
                    name = d.name;
                }
                return name;
            })
            .style("fill-opacity", 0);
        gnode.append("circle").attr({
                "r": 30,
                "class": "ghostCircle",
                "opacity": 0.2,
                "pointer-events": "mouseover"
            }).style("fill", "red")
            .on("mouseover", function(node) {
                currentContext.overCircle(node);
            })
            .on("mouseout", function(node) {
                currentContext.outCircle(node);
            });
        gnode.append("circle").attr({
                "class": "selectCircle",
                r: 30,
                opacity: 0.2
            }).style("fill", "#B0C4DE")
            .on("mouseout", function(node) {
                d3.select(this).classed("show", false);
                currentContext.hideActionItems(node, this);
            });
        //Create circle node
        gnode.append("image").attr({
            "xlink:href": function(d) {
                var href = "";
                switch (d.depth) {
                    case 0:
                        href = "/webacs/applications/guidedWorkflow/images/icons/Site_16.png";
                        break;
                    case 1:
                        href = "/webacs/applications/guidedWorkflow/images/icons/MController.png";
                        break;
                    case 2:
                        href = "/webacs/applications/guidedWorkflow/images/icons/SPGIcon.png";
                        break;
                    case 3:
                        href = "/webacs/applications/guidedWorkflow/images/icons/MAIcon.png";
                        break;
                }
                if (d.depth > 2) {
                    href = "/webacs/applications/guidedWorkflow/images/icons/MAIcon.png";
                }
                return href;
            },
            "y": -5,
            "x": -8,
            "height": 16,
            "width": 16,
            "class": "nodeCircle",
            "r": function(d) {
                currentContext.addEdit(d, this.parentNode);
                currentContext.addSpgNode(d, this.parentNode);
                currentContext.addDelete(d, this.parentNode);
                return 0;
            }
        }).style("fill", function(d) {
            return d._children ? "lightsteelblue" : "#fff";
        }).on("click", function(node) {
            currentContext.nodeClick(node, this);
        });
        nodeEnt.select(".nodeCircle")
            .attr("r", 6)
            .style("fill", function(d) {
                return d._children ? "lightsteelblue" : "#fff";
            });
        var nodeUpdate = nodeEnt.transition()
            .duration(currentContext.duration)
            .attr("transform", function(d) {
                if (d.isdelete) { // Disable nodes marked for deletion while updating nodes.
                    var groupNode = d3.select(this);
                    groupNode.classed("nodeDelete", true);
                    groupNode.select("image.iconEdit").remove();
                    groupNode.select("image.iconDelete").remove();
                    groupNode.select("image.addSpg").remove();
                }
                return "translate(" + d.x + "," + d.y + ")";
            });
        nodeUpdate.select("text")
            .style("fill-opacity", 1)
            .text(function(d) {
                var name = d.name;
                if (name.length > 15) {
                    name = name.substring(0, 15) + "...";
                }
                return name;
            });


        var nodeExit = nodeEnt.exit().transition()
            .duration(currentContext.duration)
            .attr("transform", function() {
                return "translate(" + data.x + "," + data.y + ")";
            })
            .remove();
        nodeExit.select("circle")
            .attr("r", 0);
        nodeExit.select("text")
            .style("fill-opacity", 0);
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
        this._checkChildren();
    },
    _checkChildren: function() {
        var gNodeArray = d3.selectAll("g.node"),
            context = this;
        if (!d3.select(".root").node()) {
            setTimeout(function() {
                context._checkChildren();
            }, 100);
            return;
        }
        var controllers = gNodeArray.filter(function(d) {
            return d.depth == 1; // filter out controllers
        });
        controllers.each(function(d) {
            var isKatana = context.isKatanaDevice(d),
                gnode = d3.select(this),
                plusIcon = gnode.select(".addSpg");
            if (isKatana && d.children) {
                if ((d.children.length == 8 || d.children.length > 8) || (d._children && (d._children.length == 8 || d._children.length > 8))) { // Katana will have only 8 SPG
                    plusIcon.classed("hide", true);
                } else if ((d.children.length < 8) || (d._children && d._children.length < 8)) {
                    plusIcon.classed("hide", false);
                }
            } else if (!isKatana) { // Non Katana device have only 1 SPG
                if ((d.children && d.children.length > 0) || (d._children && d._children.length > 0)) {
                    plusIcon.classed("hide", true);
                } else {
                    plusIcon.classed("hide", false);
                }
            }
        });
    },
    initDrag: function(node, domNode, dragNodes) {
        this.draggingNode = node;
        d3.select(domNode).select(".selectCircle").classed("show", false);
        d3.select(domNode).select(".addSpg").remove();
        d3.selectAll(".ghostCircle").classed("show", true);
        d3.select(domNode).classed("activeDrag", true)
            .select(".ghostCircle").attr("pointer-events", "none").classed("show", true);
        d3.selectAll("g.node")
            .sort(function(a, b) {
                if (a.id != node.id) {
                    return 1;
                } else {
                    return -1;
                }
            });
        // if nodes have children, remove the nodes and link
        if (dragNodes.length) {
            this.links = this.tree.links(dragNodes);
            // remove path links
            this.svgGroup.selectAll("path.link").data(this.links, function(d) {
                return d.target.id;
            }).remove();
            this.svgGroup.selectAll("g.node").data(dragNodes, function(d) {
                return d.id;
            }).filter(function(d) {
                if (d.id == node.id) {
                    return false;
                }
                return true;
            }).remove();
        }
        //remove Parent link
        this.svgGroup.selectAll("path.link").filter(function(d) {
            if (d.target.id == node.id) {
                return true;
            }
            return false;
        }).remove();

    },
    endDrag: function(node, domNode) {
        d3.selectAll(".ghostCircle").classed("show", false);
        d3.select(domNode).classed("activeDrag", false)
            .select(".ghostCircle").attr("pointer-events", "");
        this.updateTempConnector();
        if (this.draggingNode) {
            this.udpateNodes(this.root, this.svgGroup);
            this.addSpgNode(node, domNode);
            this.draggingNode = null;
        }
    },
    help: function(nodes) {
        var context = this;
        nodes.forEach(function(d) {
            context.totalNodes++;
            context.maxLabelLength = Math.max(d.name.length, context.maxLabelLength);
        });
    },
    pan: function(domNode, direction) {
        var speed = this.panSpeed;
        var translateCoords = d3.transform(this.svgGroup.attr("transform"));
        var zoomListener = this.zoomListener,
            translateX = "",
            translateY = "";
        if (direction == "left" || direction == "right") {
            translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
            translateY = translateCoords.translate[1];
        } else if (direction == 'up' || direction == 'down') {
            translateX = translateCoords.translate[0];
            translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
        }
        d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
        zoomListener.scale(zoomListener.scale());
        zoomListener.translate([translateX, translateY]);
    },
    /*
     * Method to create temprory connector while dragging nodes.
     */
    updateTempConnector: function() {
        var data = [];
        if (this.draggingNode !== null && this.selectedNode !== null) {
            // have to flip the source coordinates since we did this for the existing connectors on the original tree
            data = [{
                source: {
                    x: this.selectedNode.x0,
                    y: this.selectedNode.y0
                },
                target: {
                    x: this.draggingNode.x0,
                    y: this.draggingNode.y0
                }
            }];
        }
        var link = this.svgGroup.selectAll(".templink").data(data);

        link.enter().append("path")
            .attr("class", "templink")
            .attr("d", d3.svg.diagonal())
            .attr('pointer-events', 'none');

        link.attr("d", d3.svg.diagonal());

        link.exit().remove();
    },
    overCircle: function(node) {
        this.selectedNode = node;
        this.updateTempConnector();
    },
    outCircle: function(node) {
        this.selectedNode = null;
        this.updateTempConnector();
    },
    expand: function(d) {
        var currentContext = this;
        if (d._children) {
            d.children = d._children;
            d.children.forEach(currentContext.expand);
            d._children = null;
        }
    },
    collapse: function(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    },
    /*
     * Method to srot the nodes. This makes node array from leaf to root node objects.
     */
    sortTree: function() {
        this.tree.sort(function(a, b) {
            return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
        });
    },
    nodeClick: function(node, domNode) {
        if (d3.event.defaultPrevented || d3.select(domNode.parentNode).classed("nodeDelete")) {
            return; // click suppressed
        }
        node = this.toggleChildren(node);
        this.udpateNodes(node, this.svgGroup);
    },
    /*
     * Method to toggle children. This method will stash the old values in _children
     */
    toggleChildren: function(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else if (d._children) {
            d.children = d._children;
            d._children = null;
        }
        return d;
    },
    centerNode: function(source) {
        var zoomListener = this.zoomListener,
            scale = zoomListener.scale(),
            currentContext = this;
        var x = -source.x0,
            y = -source.y0;
        x = x * scale + parseInt(currentContext.width, 10) / 10;
        y = y * scale + parseInt(currentContext.height, 10) / 1.8;
        d3.select('g').transition()
            .duration(currentContext.duration)
            .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
        zoomListener.scale(scale);
        zoomListener.translate([x, y]);

    },
    addEdit: function(node, domNode) {
        var gnode = d3.select(domNode),
            currentContext = this;
        var checkimg = gnode.select("image.iconEdit"),
            foreignObject = gnode.select(".fObject");
        if (!checkimg[0][0] && node.editable && !foreignObject[0][0] && !node.preDeployed) {
            var y_axis = parseInt(gnode.select("image.nodeCircle").attr("y"), 10),
                x_axis = parseInt(gnode.select("image.nodeCircle").attr("x"), 10) + 18;
            d3.select(domNode).select(".iconEdit").remove(); // Remove if image already existed
            var imgNode = gnode.append("image");
            imgNode.attr({
                "xlink:href": "/webacs/applications/guidedWorkflow/images/edit.png",
                "height": 12,
                "width": 12,
                "class": "iconEdit",
                "x": x_axis,
                "y": y_axis
            }).on("click", function(node) {
                currentContext.editText(node, this);
            });
            imgNode.append("svg:title").text("Edit");
        }
    },
    hideActionItems: function(node, domNode) {
        // var editImage = d3.select(domNode.parentNode).select(".iconEdit")
        // editImage.remove();
    },
    editText: function(node, domNode) {
        var parentGnode = domNode.parentNode,
            context = this;
        d3.select(parentGnode).select("image.iconEdit").remove();
        var textNode = d3.select(parentGnode).select("text.nodeText");
        textNode.style('display', 'none');
        var id = dijit.getUniqueId("editText");
        if (!dojo.isIE) {
            var foreignObject = d3.select(parentGnode).append("foreignObject").attr({
                height: 25,
                width: 200,
                "class": "fObject",
                // x: textNode.attr("x"),
                x: 5,
                y: textNode.attr("y") - 20
            });
            var body = foreignObject.append("xhtml:body");
            body.append("div").attr("id", id);
            var editBox = new xwt.widget.notification.ValidationTextBox({
                style: "width:150px;",
                focused: true,
                required: true,
                value: node.name,
                dir: "ltr",
                trim: true,
                invalidMessage: context._errorMsg,
                onKeyUp: function() {
                    this.domNode.style.border = "1px solid #53636A";
                }
            }, dojo.byId(id));
            body.append("img").attr("src", "/webacs/applications/guidedWorkflow/images/Save_16.png")
                .on("click", function(node) {
                    context.saveText(node, this, editBox, domNode);
                });
        } else {
            var position = dojo.position(parentGnode);
            var editDiv = d3.select("#container").append("div").attr({
                "id": "ieEdit"
            });
            editDiv.style({
                "position": "absolute",
                "top": (position.y - 220) + "px",
                "left": (position.x + 20) + "px",
                "z-index": 100000200
            });
            editDiv.append("div").attr("id", id);
            var editBox1 = new xwt.widget.notification.ValidationTextBox({
                style: "width:150px;",
                focused: true,
                required: true,
                value: node.name,
                dir: "ltr",
                trim: true,
                invalidMessage: context._errorMsg
            }, dojo.byId(id));
            editDiv.append("img")
                .attr("src", "/webacs/applications/guidedWorkflow/images/Save_16.png")
                .on("click", function() {
                    context.saveText(node, this, editBox1, parentGnode, id);
                });
        }
    },
    saveText: function(node, domNode, textboxWidget, imageNode, id) {
        var body = domNode.parentNode;
        var input = d3.select(body).select("input"),
            inputVal = input.node().value;
        var gnode = d3.select(body.parentNode.parentNode);
        if (dojo.isIE) {
            input = dojo.byId(id);
            inputVal = input.value;
            gnode = d3.select(imageNode);
            input = d3.select(input);
            if (!inputVal) {
                input.style('border', '1px solid red');
                return;
            }
        }
        if (!inputVal) { // check empty
            return;
        }
        inputVal = dojo.trim(inputVal);
        if (this._mobilityGroupList.indexOf(inputVal.toLowerCase()) >= 0) { // check for existing mobility group name.
            textboxWidget.state = "Error";
            textboxWidget.invalidMessage = this._groupErrorMsg;
            textboxWidget.domNode.style.border = "1px solid red";
            return;
        }
        var regEx = new RegExp("\\s");
        if (regEx.test(inputVal)) {
            textboxWidget.state = "Error";
            textboxWidget.invalidMessage = this.i18nMsg["create_group_error2"];
            textboxWidget.domNode.style.border = "1px solid red";
            return;
        }
        node.name = inputVal;
        var textNode = gnode.select("text.nodeText");
        if (inputVal.length > 15) {
            inputVal = inputVal.substring(0, 15) + "...";
        }
        textNode.text(inputVal).style('display', 'block');
        if (gnode.classed("root")) {
            d3.select(".siteName").select("span").html(node.name);
        }
        gnode.select(".fObject").remove();
        gnode.select(".selectCircle").classed("show", false);
        textboxWidget.destroyRecursive();
        if (dojo.isIE) {
            dojo.destroy("ieEdit");
        }
        this.addEdit(node, gnode.node());
    },
    /*
     * Method to implement drag and drop rules.
     */
    noDrop: function(node, domNode, depth) {
        var gNodes = d3.selectAll("g.node"),
            context = this;
        //No drag and drop nodes of same depth/level
        gNodes.filter(function(d) {
            return d.depth == depth;
        }).select(".ghostCircle").classed("show", false);
        var controllers = gNodes.filter(function(d) {
            return d.depth == 1; // filter out controller nodes.
        });
        var rootNode = d3.select(".root");
        if (depth == 2) {
            rootNode.select(".ghostCircle").classed("show", false);
            rootNode.select(".selectCircle").classed("show", false);
            // rootNode.select(".iconEdit").remove();
            controllers.each(function(controllerNode) {
                var controller = d3.select(this);
                if (context.isKatanaDevice(controllerNode) && (controllerNode.children && controllerNode.children.length < 8 || controllerNode._children && controllerNode._children.length < 8)) {
                    controller.select(".ghostCircle").classed("show", true);
                    controller.select(".selectCircle").classed("show", true);
                } else if ((controllerNode.children && controllerNode.children.length > 0 || controllerNode._children && controllerNode._children.length > 0)) {
                    controller.select(".ghostCircle").classed("show", false);
                    controller.select(".selectCircle").classed("show", false);
                }
            });
            var agents = gNodes.filter(function(d) {
                return d.depth > 2; // fiter out agent nodes.
            });
            agents.select(".ghostCircle").classed("show", false);
            agents.select(".selectCircle").classed("show", false);
        }
        //Agents drop to controllers.
        if (depth > 2) {
            controllers.select(".ghostCircle").classed("show", false);
            controllers.select(".selectCircle").classed("show", false);
        }
        if (depth == 1) {
            var controllerAgents = gNodes.filter(function(d) {
                return d.depth > 2; // fiter out agent nodes.
            });
            controllerAgents.select(".ghostCircle").classed("show", false);
            controllerAgents.select(".selectCircle").classed("show", false);
        }
        var spgs = gNodes.filter(function(d) {
            return d.depth == 2 && (d.children && d.children.length == 8 || d.children && d.children.length > 8); // Each spg can have max of 8 Agents.
        });
        spgs.select(".ghostCircle").classed("show", false);
        spgs.select(".selectCircle").classed("show", false);

        var isKatanaExist = false;
        controllers.each(function(d) {
            if (context.isKatanaDevice(d)) {
                rootNode.select(".ghostCircle").classed("show", false);
                rootNode.select(".selectCircle").classed("show", false);
                isKatanaExist = true;
            }
        });
        if (!isKatanaExist) {
            var rootData = rootNode.datum();
            if (rootData.children && (rootData.children.length == 7 || rootData.children.length > 7) && depth != 2) {
                rootNode.select(".ghostCircle").classed("show", false);
                rootNode.select(".selectCircle").classed("show", false);
            } else if (rootData.children.length < 7 && depth != 2) {
                rootNode.select(".ghostCircle").classed("show", true);
                rootNode.select(".selectCircle").classed("show", false);
            }
        }

        //No drag and drop in same parent/existing node.
        gNodes.filter(function(d) {
            return d == node.parent;
        }).select(".ghostCircle").classed("show", false);

        gNodes.each(function(node) {
            if (node.isdelete) {
                var gnode = d3.select(this);
                gnode.select(".ghostCircle").classed("show", false);
                gnode.select(".selectCircle").classed("show", false);
            }
        });
    },
    deleteNode: function(node, domeNode) {
        var context = this;
        var messageBox = new xwt.widget.notification.Alert({
            messageType: "warning",
            buttons: [{
                label: "Yes",
                baseClass: "defaultButton",
                onClick: function() {
                    try {
                        context.getDeleteExpression(node);
                        if (node.preDeployed) { // Predeployed nodes should be only marked for delete.It should not removed from tree.
                            context.markNodes(node, domeNode.parentNode);
                        } else {
                            context.removeNodes(node, domeNode.parentNode);
                        }
                        context.udpateNodes(context.root, context.svgGroup);
                    } catch (e) {
                        console.error(e);
                        messageBox.hide();
                    }
                    if (!d3.select(".root").node()) {
                        d3.select(".siteName").style("display", "none");
                    }
                }
            }, {
                label: "No",
                onClick: function() {
                    messageBox.hide();
                }
            }],
            dontShowAgainOption: false
        });
        var message = "";
        // if (node.preDeployed) {
        //     message = node.name + " will be marked for deletion. Do you want to continue?";
        // } else {
        //     message = node.name + " will be deleted. Do you want to continue?";
        // }
        //
        if (node.preDeployed) {
            message = this.wirelessUtil.customMessageHandler("create_group_delete_warn", node.name);
        } else {
            message = this.wirelessUtil.customMessageHandler("create_group_delete_warn1", node.name);
        }
        messageBox.setDialogContent(message);
    },
    markNodes: function(node, domNode) { // Mark nodes for delete.
        var selectedNodes = this.tree.nodes(node),
            context = this;
        this.svgGroup.selectAll("g.node").filter(function(d) {
            if (selectedNodes.indexOf(d) >= 0) {
                return d;
            }
        }).attr("r", function(k) {
            if (k.preDeployed) {
                var groupNode = d3.select(this);
                k.isdelete = true; // Flag to check node marked for deletion
                var href = groupNode.select(".nodeCircle").attr("href"),
                    newHref = href.split(".");
                href = newHref[0] + "Cross" + "." + newHref[1];
                groupNode.select(".nodeCircle").attr("href", href);
                groupNode.classed("nodeDelete", true);
                groupNode.select("image.iconEdit").remove();
                groupNode.select("image.iconDelete").remove();
                groupNode.select("image.addSpg").remove();
            } else {
                context.removeNodes(k, domNode);
            }
            context._updateDeleteDeivces(k);
        });

    },
    removeNodes: function(node) {
        var delNodes = this.tree.nodes(node),
            context = this;
        if (delNodes.length) {
            var links = this.tree.links(delNodes);
            // remove links
            this.svgGroup.selectAll("path.link").data(links, function(d) {
                return d.target.id;
            }).remove();
            // remove nodes
            this.svgGroup.selectAll("g.node").data(delNodes, function(d) {
                return d.id;
            }).remove();
            //Remove parent link
            this.svgGroup.selectAll("path.link").filter(function(d) {
                if (d.target.id == node.id) {
                    return true;
                }
                return false;
            }).remove();
        }
        for (var i = 0; i < delNodes.length; i++) {
            context._updateDeleteDeivces(delNodes[i]);
        }
        var parentObj = node.parent;
        var children = parentObj.children;
        for (var child in children) {
            var childDetial = children[child];
            if (childDetial.id == node.id) {
                children.splice(child, 1); // remove node from parent object.
            }
        }
    },
    _updateGroupName: function() {
        var siteName = d3.select(".siteName"),
            context = this;
        siteName.classed("hide", true);
        var closestParent = siteName.node().parentNode,
            editNode = d3.select(closestParent).append("span"),
            textNode = editNode.append("span").node();
        var editBox = new xwt.widget.notification.ValidationTextBox({
            style: "width:150px;margin-left:5px;",
            focused: true,
            required: true,
            value: context.root.name,
            dir: "ltr",
            trim: true,
            invalidMessage: context._errorMsg
        }, textNode);
        var imgNode = editNode.append("img");
        imgNode.attr({
            "src": "/webacs/applications/guidedWorkflow/images/Save_16.png",
            "class": "groupNameEdit"
        }).on("click", function() {
            context._saveGroupName(editBox, this);
        });

    },
    _saveGroupName: function(textwidget, domNode) {
        if (textwidget.isValid()) {
            var value = textwidget.value;
            this.root.name = value;
            d3.select(".siteName").classed("hide", false).select("span").html(value);
            d3.select(".root").select("text").text(value);
            d3.select(domNode).remove();
            textwidget.destroyRecursive();
        }
    },
    addSpgNode: function(node, domNode) {
        var groupNode = d3.select(domNode),
            isAddExist = groupNode.select("image.addSpg"),
            context = this;
        if (!isAddExist[0][0] && node.depth == 1) {
            // d3.select(".addSpg").remove();
            var addImage = groupNode.append("image");
            var imgId = dijit.getUniqueId("spg");
            addImage.attr({
                "xlink:href": "/webacs/applications/guidedWorkflow/images/plus_icon.png",
                "height": 10,
                "width": 10,
                "class": "addSpg",
                "x": 10,
                "y": -15,
                "id": imgId
            }).on("click", function() {
                var popover = context.createAddSpgPopover(node);
                popover.openAroundNode(addImage.node());
                context.updatePopoverPosition(popover, addImage);
            });
            addImage.append("svg:title").text(this.i18nMsg["create_group_spg_warn"]);
        }
    },
    /*
     *Workaround method for displaying xwt popover inside svg elements. ONly in firefox and Internet explorer
     */
    updatePopoverPosition: function(popover, refNode) {
        var position = dojo.position(refNode.node());
        var popoverDom = d3.select("#" + popover.attr("id")).node().parentNode;
        d3.select(popoverDom).style({
            "top": (position.y + 10) + "px",
            "left": (position.x + 5) + "px"
        });
    },
    createAddSpgPopover: function(node) {
        var popoverId = dijit.getUniqueId("popover");
        var props = {
            pinnable: false,
            sideAlign: false,
            title: 'Add Switch Peer Group',
            showHelp: false
        };
        var popoverNode = new xwt.widget.layout.Popover(props);
        popoverNode.attr("id", popoverId);
        this._spgPopover = popoverNode;
        popoverNode.startup();
        var newSpgWidget = new xmp.applications.workflow.createProfile.js.addNewSpg({
            designObj: this
        }, dojo.create('div', {}, popoverNode.containerNode));
        newSpgWidget.init(node);
        return popoverNode;
    },
    updateSpdNode: function(node, name) {
        var nodeDeatil = node;
        var spgJson = {
            "name": name,
            "preDeployed": false,
            "editable": true
        };
        var newNodes = this.tree.nodes(spgJson).reverse();
        nodeDeatil = this.updateSpgChildren(node, newNodes[0]);
        this.udpateNodes(nodeDeatil, this.svgGroup);
    },
    updateSpgChildren: function(node, newnode) {
        if (!node.children) {
            var childrenArray = [];
            childrenArray.push(newnode);
            node._children = childrenArray; // update children as hidden node.
            node = this.toggleChildren(node);
        } else if (node.children !== undefined) {
            var children = node.children;
            children.push(newnode);
            node.children = children;
        }
        return node;
    },
    /*
     * Method to check duplicate name exist in tree.
     */
    isNodeNameExists: function(name, node) {
        var duplicate = false;
        var nodes = this.tree.nodes(node);
        for (var nodedata in nodes) {
            var nodeDetail = nodes[nodedata];
            if (nodeDetail.name.toLowerCase() == name.toLowerCase()) {
                duplicate = true;
            }
        }
        return duplicate;
    },
    addDelete: function(node, domNode) {
        var gNode = d3.select(domNode),
            context = this,
            imageNode = gNode.select("image.iconDelete");
        if (!imageNode.node()) {
            imageNode.remove();
            var deleteNode = gNode.append("image")
                .attr({
                    "class": "iconDelete",
                    "height": 10,
                    "width": 10,
                    "xlink:href": "/webacs/applications/guidedWorkflow/images/icons/delete_16.png",
                    "x": 10,
                    "y": function(d) {
                        var y_axis = 0;
                        if (d.editable) {
                            y_axis = 7;
                        }
                        return y_axis;
                    }
                }).on("click", function(d) {
                    context.deleteNode(d, this);
                });

            deleteNode.append("svg:title").text(this.i18nMsg["delete"]);
        }
    },
    getData: function() {
        return this.convertD3ToArchJson();
    },
    isKatanaDevice: function(node) {
        var isKatana = false;
        if (node && node.deviceType) {
            isKatana = /.*5760.*controller.*/ig.test(node.deviceType); // regex to find katana device(5760)
        }
        return isKatana;
    },
    getDeleteExpression: function(nodeVal) {
        var nodeList = this.tree.nodes(this.root);
        var deletedNode = nodeList.filter(function(d) {
            return nodeVal.name == d.name;
        });
        var seprator = "#",
            comma = ",",
            agentSeprator = ":";
        var node = deletedNode[0];
        if (!node || !node.preDeployed) { // No delete expression for new devices.
            return;
        }
        var existValue = this._deleted_controllers ? this._deleted_controllers + "_" : "";
        var controller = "";
        var agent = this._deleted_agents ? this._deleted_agents + "_" : "",
            spg = this._deleted_spgs ? this._deleted_spgs + "_" : "";
        switch (node.depth) {
            case 0:
                var groupExpression = "",
                    controllers = node.children ? node.children : node._children ? node._children : [];
                for (var i = 0; i < controllers.length; i++) {
                    var controllerDetail = controllers[i],
                        contExp = "",
                        groupspgs = controllerDetail.children ? controllerDetail.children : controllerDetail._children ? controllerDetail._children : [];
                    contExp = "_" + controllerDetail.id + seprator;
                    for (var j = 0; j < groupspgs.length; j++) {
                        var groupspg = groupspgs[j];
                        contExp += groupspg.name + ":";
                        var agents = groupspg.children ? groupspg.children : groupspg._children ? groupspg._children : [],
                            agentIds = [];
                        for (var k = 0; k < agents.length; k++) {
                            agentIds.push(agents[k].id);
                        }
                        contExp += agentIds.toString();
                    }
                    groupExpression += contExp;
                    controller = groupExpression;
                }
                break;
            case 1:
                controller = existValue ? existValue : "_";
                var controllerExpression = node.id;
                var nodeChildren = node.children ? node.children : node._children ? node._children : [];
                if (nodeChildren && nodeChildren.length) {
                    var spgs = node.children,
                        spgId = "";
                    for (var index in spgs) {
                        var detail = spgs[index];
                        spgId += seprator + detail.name + agentSeprator;
                        if (detail.children && detail.children.length) {
                            var controllerAgents = detail.children,
                                id = "";
                            for (var AgentIndex in controllerAgents) {
                                id += controllerAgents[AgentIndex].id + comma;
                            }
                            spgId += id.substring(0, id.length - 1);
                        }
                    }
                    controllerExpression += spgId;
                }
                controller += controllerExpression;
                break;
            case 2:
                var expression = "_" + node.parent.id + seprator,
                    spgChildren = node.children ? node.children : node._children ? node._children : [];
                expression += node.name + agentSeprator;
                if (spgChildren && spgChildren.length) {
                    var agentId = "";
                    for (var d in spgChildren) {
                        agentId += spgChildren[d].id + comma;
                    }
                    expression += agentId.substr(0, agentId.length - 1);
                }
                spg += expression;
                break;
            case 3:
                var controllerNode = node.parent.parent,
                    spgNode = node.parent;
                var agentExpression = "_" + controllerNode.id + seprator + spgNode.name + agentSeprator + node.id;
                agent += agentExpression;
                break;
        }
        this._deleted_agents = agent;
        this._deleted_spgs = spg;
        this._deleted_controllers = controller;
        return controller;
    },
    _updateDeleteDeivces: function(node) {
        var nodes = this.tree.nodes(this.root),
            deletedNode = nodes[nodes.indexOf(node)];
        if (deletedNode) {
            var id = deletedNode.id,
                devices = [1, 3];
            if (id && this._deletedDevices.indexOf(id) < 0 && devices.indexOf(deletedNode.depth) >= 0 && node.preDeployed) {
                this._deletedDevices.push(id);
            }
        }
    },
    getDeletedDevices: function() {
        return this._deletedDevices;
    },
    getAllDevices: function() {
        var devicesList = [],
            rootDom = d3.select(".root").node(),
            root = "";
        if (rootDom) {
            root = d3.select(".root").datum();
        }
        if (root && (root.children && root.children.length || root._children && root._children.length)) {
            devicesList = d3.selectAll(".node").data();
        }
        return devicesList;
    },
    /*
     *Method for GuidedWorkflow json object to D3 json object.
     */
    convertArchToD3Json: function() {
        var ids = [];
        if (!this.json.mobilityGroups) {
            return {};
        }
        var mobGroups = this.json.mobilityGroups[0],
            groupChild = [],
            controllerList = mobGroups.mcList,
            viewJson = {};
        viewJson["id"] = mobGroups.id;
        viewJson["name"] = mobGroups.name;
        viewJson["parentId"] = mobGroups.parentId;
        viewJson["preDeployed"] = mobGroups.preDeployed;
        if (mobGroups.preDeployed) {
            viewJson["editable"] = false;
        } else {
            viewJson["editable"] = true;
        }
        viewJson["children"] = groupChild;
        for (var controller in controllerList) {
            var controllerDetail = controllerList[controller],
                controllerChild = [],
                spgs = controllerDetail.spgs;
            var controllerJson = {
                "id": controllerDetail.id,
                "name": controllerDetail.name,
                "parentId": controllerDetail.parentId,
                "preDeployed": controllerDetail.preDeployed,
                "capability": controllerDetail.capability,
                "deviceIpAddress": controllerDetail.deviceIpAddress,
                "deviceType": controllerDetail.deviceType,
                "ipAddress": controllerDetail.ipAddress,
                "children": controllerChild,
                "editable": false
            };
            for (var spg in spgs) {
                var spgDetail = spgs[spg],
                    spgChild = [],
                    agents = spgDetail.maAgents,
                    spgId = spgDetail.id;
                if (ids.indexOf(spgId) < 0) {
                    ids.push(spgId);
                } else {
                    spgId = spgId + "#$#";
                }
                var spgJson = {
                    "id": spgId,
                    "name": spgDetail.name,
                    "parentId": spgDetail.parentId,
                    "preDeployed": spgDetail.preDeployed,
                    "children": spgChild,
                    "editable": spgDetail.preDeployed ? false : true
                };
                for (var agent in agents) {
                    var agentDetail = agents[agent];
                    var agentJson = {
                        "id": agentDetail.id,
                        "name": agentDetail.name,
                        "preDeployed": agentDetail.preDeployed,
                        "newIPAddress": agentDetail.newIPAddress,
                        "deviceIpAddress": agentDetail.deviceIpAddress,
                        "editable": false,
                        "ipAddress": agentDetail.ipAddress,
                        "deviceType": agentDetail.deviceType,
                        "type": "Agent"
                    };
                    spgChild.push(agentJson);
                }
                controllerChild.push(spgJson);
            }
            groupChild.push(controllerJson);
        }
        return viewJson;
    },
    /*
     *Method for converting d3 json object to GuidedWorkflow json object
     */
    convertD3ToArchJson: function() {
        var d3Json = this.root;
        var mobilityArch = {};
        var mobilityGroups = [];
        var mobilityGroup = {};
        mobilityGroup.id = d3Json.id;
        mobilityGroup.name = d3Json.name;
        mobilityGroup.parentId = "";
        mobilityGroup.preDeployed = false;
        if (d3Json.isdelete) {
            mobilityGroup.isdelete = true;
        }


        var mcList = [];

        var mcs = d3Json.children ? d3Json.children : d3Json._children;
        for (var mc in mcs) {
            var mobController = mcs[mc],
                mobControllerJson = {},
                spgList = [];
            mobControllerJson.id = mobController.id;
            mobControllerJson.name = mobController.name;
            mobControllerJson.parentId = "";
            mobControllerJson.preDeployed = mobController.preDeployed;
            mobControllerJson.capability = "MC";
            mobControllerJson.deviceType = "";
            mobControllerJson.ipAddress = mobController.ipAddress;
            mobControllerJson.deviceIpAddress = mobController.deviceIpAddress;
            if (mobController.isdelete) {
                mobControllerJson.isdelete = true;
            }

            var spgs = mobController.children ? mobController.children : mobController._children;
            for (var spg in spgs) {
                var spgroup = spgs[spg],
                    spgJson = {},
                    maList = [],
                    spgId = spgroup.id;
                spgId = spgId.toString().split("#$#")[0];
                spgJson.id = spgId;
                spgJson.name = spgroup.name;
                spgJson.parentId = "";
                spgJson.preDeployed = false;
                if (spgroup.isdelete) {
                    spgJson.isdelete = true;
                }

                var mas = spgroup.children ? spgroup.children : spgroup._children;
                for (var ma in mas) {
                    var mobAgent = mas[ma],
                        maJson = {};
                    maJson.id = mobAgent.id;
                    maJson.name = mobAgent.name;
                    maJson.preDeployed = mobAgent.preDeployed;
                    maJson.newIPAddress = "";
                    maJson.ipAddress = mobAgent.ipAddress;
                    maJson.deviceIpAddress = mobAgent.deviceIpAddress;
                    if (mobAgent.isdelete) {
                        maJson.isdelete = true;
                    }
                    maList.push(maJson);
                }
                mobilityArch["mobilityAgents"] = maList;
                spgJson.maAgents = maList;
                spgList.push(spgJson);
            }

            mobControllerJson.spgs = spgList;

            mcList.push(mobControllerJson);
        }
        mobilityGroup.mcList = mcList;
        mobilityGroups.push(mobilityGroup);
        mobilityArch["mobilityGroups"] = mobilityGroups;
        mobilityArch["mobilityControllers"] = mcList;

        mobilityArch["isPreDeployed"] = this.json.isPreDeployed;
        mobilityArch["mobilityDomain"] = this.json.mobilityDomain;

        mobilityArch.deleted_controllers = this._deleted_controllers;
        mobilityArch.deleted_spgs = this._deleted_spgs;
        mobilityArch.deleted_agents = this._deleted_agents;

        console.log("json values:::", JSON.stringify(mobilityArch));
        return mobilityArch;
    }
});


/*
 * Class to create tooltip for Adding New SPG
 */
dojo.declare("xmp.applications.workflow.createProfile.js.addNewSpg", [dijit._Widget, dijit._Templated], {
    widgetsInTemplate: true,
    // templateString: dojo.cache('xmp.applications.workflow.createProfile.js', 'webacs/applications/guidedWorkflow/js/templates/_addNewSPG.html'),
    templateString: dojo.cache('xmp.applications.workflow.createProfile.js', 'templates/_addNewSPG.html'),

    designObj: null,
    init: function(node) {
        this.util = new ifm.guided.workflow.wirelessview.WirelessUtil();
        this.i18nMsg = this.util.i18nMsg;
        this.mclabelNode.innerHTML = this.i18nMsg["create_group_controller"];
        this.spgLabelNode.innerHTML = this.i18nMsg["create_group_spg"];
        this.mcTitleNode.innerHTML = node.name;
        this.spgTextBox.attr('value', '');
        this.spgSaveButton.attr("disabled", true);
        this._node = node;
    },
    _onKeyUp: function() {
        var isduplicate = this.designObj.isNodeNameExists(this.spgTextBox.attr('value'), this._node),
            isInValid = false;
        var regEx = new RegExp("\\s");
        var value = this.spgTextBox.getValue();
        value = dojo.trim(value);
        if (value && regEx.test(value)) {
            this.spgTextBox.state = "Error";
            this.spgTextBox.invalidMessage = this.i18nMsg["create_group_error2"];
            this.spgTextBox.displayMessage(this.i18nMsg["create_group_error2"]);
            this.spgTextBox.domNode.style.border = "1px solid red";
            isInValid = true;
        }
        if (this.spgTextBox.textbox.value.length === 0 || isduplicate || isInValid) {
            this.spgSaveButton.attr("disabled", true);
        } else {
            this.spgTextBox.state = "Normal";
            this.spgTextBox.domNode.style.border = "1px solid #53636A";
            this.spgSaveButton.attr("disabled", false);
        }
    },
    _onSaveClick: function() {
        var spgName = this.spgTextBox.attr('value');

        if (!spgName) {
            return;
        }
        try {
            this.designObj.updateSpdNode(this._node, spgName);
        } catch (e) {
            console.error("error in updating spg nodes:", e);
        }
        this.designObj._spgPopover.hide();
    },
    _onCancelClick: function() {
        this.designObj._spgPopover.hide();
        try {
            this.designObj.udpateNodes(this.designObj.root, this.designObj.svgGroup);
        } catch (e) {
            console.error("Error when updating heirarchy", e);
        }
    }
});
