export default class Popover {
    constructor(tree, node, nodeObj) {
        this.tree = tree;
        this.hookNode = node;
        this.nodeObj = nodeObj;
        this.initPopover();
    }
    initPopover() {
        let [content] = this.getPopoverContent();
        let popSettings = {
            "html": true,
            "container": "body",
            "content": content,
            "trigger": "click",
            "title": "Add node"
        };
        $(this.hookNode)
            .popover(popSettings)
            .on("shown.bs.popover", () => {
                $("#nodeName")
                    .focus();
            });
        this.show();
    }
    show() {
        $(this.hookNode)
            .popover("show");
    }
    hide() {
        $(this.hookNode)
            .popover("hide");
    }
    destroy() {
        $(this.hookNode)
            .popover("destroy");
    }
    getPopoverContent() {
        // <div>
        //   <input>
        //   <div>
        //     <button>Add</button>
        //     <button>Close</button>
        //   </div>
        // </div>
        let content = $("<div>");
        let input = $("<input>")
            .addClass("form-control")
            .attr({
                "placeholder": "Name..",
                "id": "nodeName",
                "required": true
            });
        content.append(input);

        let btnGroup = $("<div>")
            .addClass("popoverBtnGroup");
        let addBtn = $("<button>")
            .addClass("btn btn-primary")
            .html("Add")
            .on("click", () => {
                let [name] = input;
                this.tree.addNode(this.nodeObj, name.value);
                this.destroy();
            });
        let closeBtn = $("<button>")
            .addClass("btn btn-defalut")
            .html("Close")
            .on("click", this.destroy.bind(this));

        btnGroup.append(closeBtn);
        btnGroup.append(addBtn);
        content.append(btnGroup);
        return content;
    }
}
