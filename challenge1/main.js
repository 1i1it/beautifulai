// App

class App {
    constructor() {
        this.canvas = new SlideCanvas();
        $("body").append(this.canvas.render());

        this.canvas.addRootElement(new MyContainerElement());

        this.layoutCanvas(false);

        $(window).on("resize", () => {
            this.layoutCanvas(false)
        });
    }

    layoutCanvas(animate) {
        var padding = 50;
        var canvasBounds = {
            left: padding,
            top: padding,
            width: window.innerWidth - padding * 2,
            height: window.innerHeight - padding * 2
        };
        this.canvas.layout(canvasBounds, animate);
    }
}

// SlideCanvas

class SlideCanvas {
    render() {
        this.$el = $("<div/>").addClass("canvas");
        return this.$el;
    }

    addRootElement(element) {
        this.element = element;
        this.element.canvas = this;

        this.$el.append(element.render());
        element.renderUI();
    }

    layout(bounds, animate) {
        this.$el.css(bounds);

        if (this.element) {
            var elementBounds = {
                left: 0,
                top: 0,
                width: bounds.width,
                height: bounds.height
            };
            this.element.layout(elementBounds, animate);
        }
    }
}

// Elements

class BaseElement {
    render() {
        this.$el = $("<div/>");
        this.$el.addClass("element");
        return this.$el;
    }

    layout(bounds, animate) {
        if (animate) {
            this.$el.animate(bounds);
        } else {
            this.$el.css(bounds);
        }
    }

    renderUI() {

    }
}

class SimpleBox extends BaseElement {

    constructor(label) {
        super();
        this.label = label;
    }

    render() {
        this.$el = $("<div/>");
        this.$el.addClass("element simplebox");

        this.$el.text(this.label);

        return this.$el;
    }

    renderUI() {
        var $button = $("<div/>").addClass("close").text("x").hide();

        this.$el.append($button);

        this.$el.hover(event=>{
            $button.show();
        }, event=>{
            $button.hide();
        });

        $button.on("click", () => {
            this.$el[0].dispatchEvent(new Event("itemRemove"));
        });
    }
}

class SimpleContainer extends BaseElement {
    constructor() {
        super();
        this.childElements = [];
    }

    render() {
        this.$el = $("<div/>");
        this.$el.addClass("element");

        this.addChildElement(new SimpleBox("SimpleBox"));

        return this.$el;
    }

    layout(bounds) {
        this.childElements[0].layout(bounds);
    }

    renderUI() {
        var $button = $("<div/>").addClass("control").text("Change Color");
        this.$el.append($button);

        $button.on("click", () => {
            this.childElements[0].$el.css("background", "orange");
        });
    }

    addChildElement(element) {
        this.childElements.push(element);
        element.parentElement = this;

        this.$el.append(element.render());
        element.renderUI();
    }
}

class MyContainerElement extends SimpleContainer {

    constructor() {
        super();
        this.allCreatedElementCount = 1;
    }


    render() {
        this.$el = $("<div/>");
        this.$el.addClass("element");

        this.addChildElement(new SimpleBox(this.allCreatedElementCount));

        return this.$el;
    }

    layoutChildElements(bounds, animate) {
        this.childElements.forEach((element, index, arr) => {
            var padding = 50;
            var gap = 20;
            var elementHeight = 100;
            var elementWidth = (bounds.width - 2*padding - gap*(arr.length-1)) / arr.length;
            var elementBounds = {
                left: padding + index*(elementWidth+gap),
                top: padding + (bounds.height - 2*padding - elementHeight)/2,
                width: elementWidth,
                height: elementHeight
            };
            element.layout(elementBounds, animate);
        });
    }


    layout(bounds, animate) {
        this.currentBounds = bounds;
        this.$el.css(bounds);
        this.layoutChildElements(bounds, animate);
    }

    deleteChildElement(element) {
        var index = this.childElements.indexOf(element);
        if (index > -1) {
            this.childElements.splice(index, 1);
            element.$el[0].remove();
            this.layoutChildElements(this.currentBounds,true);
        }
    }

    addChildElement(element) {
        super.addChildElement(element);
        this.allCreatedElementCount++;
        element.$el[0].addEventListener("itemRemove",event=>{
            this.deleteChildElement(element);
        });
    }

    renderUI() {
        var $button = $("<div/>").addClass("control").text("Add Item");
        this.$el.append($button);

        $button.on("click", () => {
            this.addChildElement(new SimpleBox(this.allCreatedElementCount));
            this.layoutChildElements(this.currentBounds,true);
        });
    }

}