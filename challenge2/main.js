class EventDispatcher {

    constructor() {
        this.eventListeners = new Map();
    }

    addEventListener(eventType, callback) {
        this.eventListeners.has(eventType) || this.eventListeners.set(eventType, []);
        this.eventListeners.get(eventType).push(callback);
    }

    removeEventListener(eventType, callback) {
        let eventListeners = this.eventListeners.get(eventType);
        let index;

        let checkIfFunction = function (obj) {
            return typeof obj == 'function' || false;
        }

        if (eventListeners && eventListeners.length) {
            index = eventListeners.reduce((i, listener, indx) => {
                return (checkIfFunction(listener) && listener === callback) ?
                    i = indx :
                    i;
            }, -1);

            if (index > -1) {
                eventListeners.splice(index, 1);
                this.eventListeners.set(eventType, eventListeners);
                return true;
            }
        }
        return false;
    }

    dispatchEvent(eventType, ...args) {
        let eventListeners = this.eventListeners.get(eventType);

        if (eventListeners && eventListeners.length) {
            eventListeners.forEach((eventListeners) => {
                eventListeners(...args);
            });
            return true;
        }
        return false;
    }
}

class Service extends EventDispatcher {
    constructor({baseURl, endPoint}) {
        super()
        this.baseURL = baseURl;
        this.endPoint = endPoint;
    }

    //implementation specific
    formRequest(url, params) {
        return Promise.reject("Implement in Subclass");
    }

    getURL() {
        return this.baseURL + "/" + this.endPoint;
    }

    getEntities(params, options) {
        let opt = Object.assign({},options);
        return this.formRequest(opt.url||this.getURL(), params);
    }

    getEntity(id, params, options) {
        let opt = Object.assign({},options);
        return this.formRequest(opt.url||(this.getURL() + "/" + this.id), params);
    }
}

class PeopleService extends Service {
    formRequest(url, params) {
        return Promise.resolve($.get(url, params, ()=>{this.dispatchEvent("loaded")}));
    }
}

class BaseModel extends EventDispatcher {

    constructor(initObj,service) {
        super();
        this.service = service;
        Object.assign(this,JSON.parse(JSON.stringify(initObj)));
        this.dispatchEvent('created');
    }

    fetch(params,options){
        this.service.getEntity(this.id,params, options).then((resp) => {
            this.parseResponse(resp);
            this.dispatchEvent('loaded');
        }).catch((reason) => {
            this.dispatchEvent('error', reason);
        });
    }
}

class Person extends BaseModel {
    fetch(params,options){
        super.fetch(this.id,params,Object.assign(options||{},{url:this.url}));
    }

    fetchPlanet(params, options) {
        this.service.getEntity(this.id,params, Object.assign(options||{},{url:this.homeworld})).then((resp) => {
            this.homeWorldInfo = resp;
            this.dispatchEvent('planetLoaded', this.homeWorldInfo);
        }).catch((reason) => {
            this.dispatchEvent('error', reason);
        });
    }
}

class BaseCollection extends EventDispatcher {

    constructor({modelClass, models, service}) {
        super();
        this.modelClass = modelClass;
        this.models = models;
        this.metadata = {};
        this.service = service;
    }

    parseEntities(resp){
        return resp;
    }

    parseMetadata(resp){
        this.metadata = null;
    }

    clear() {
        this.models = [];
    }

    parseResponse(resp) {
        this.models = [];
        this.parseMetadata(resp);
        this.parseEntities(resp).forEach((item)=>{
            let modelInstance = new this.modelClass(item);
            modelInstance.service = this.service;
            this.dispatchEvent('itemCreated',modelInstance);
            this.models.push(modelInstance);
            this.dispatchEvent('added',modelInstance);
        });
    }

    fetch(params, options) {
        this.service.getEntities(params, options).then((resp) => {
            this.parseResponse(resp);
            this.hasLoaded = true;
            this.dispatchEvent('loaded');
        }).catch((reason) => {
            this.dispatchEvent('error', reason);
        });
    }
}

class PeopleCollection extends BaseCollection {
    constructor() {
        super({
            modelClass: Person,
            models:[],
            service: new PeopleService({baseURl: "http://swapi.co/api", endPoint: "people"})
        });
        this.metadata = {
            pageSize: 10,
            total: 0,
            page: 0
        }
    }
    parseEntities(resp){
        return resp.results;
    }

    parseMetadata(resp){
        if(resp) {
            this.metadata.total = resp.count;
            this.metadata.next = resp.next;
            this.metadata.prev = resp.previous;
        }
    }


}

class App {
    constructor() {
        this.canvas = new SlideCanvas();
        this.collection = new PeopleCollection();
        this.listContainer = new ListContainer();

        this.listContainer.addEventListener('itemClick',(itemModel)=>{
            itemModel.fetchPlanet();
        });

        this.listContainer.addEventListener('search',(searchString)=>{
            if(this.collection.hasLoaded)
                this.listContainer.deleteAllChildElement();
            this.collection.fetch({search:searchString});
        });

        this.listContainer.addEventListener('nextPage',(searchString)=>{

            if(!this.collection.metadata.next)
                return;

            if(this.collection.hasLoaded)
                this.listContainer.deleteAllChildElement();
            this.collection.fetch({search:searchString},{url:this.collection.metadata.next});
        });

        this.listContainer.addEventListener('prevPage',(searchString)=>{

            if(!this.collection.metadata.prev)
                return;

            if(this.collection.hasLoaded)
                this.listContainer.deleteAllChildElement();
            this.collection.fetch({search:searchString},{url:this.collection.metadata.next});
        });

        this.canvas.addEventListener('rendered', (eventData) => {
            this.collection.fetch();
        });

        this.collection.addEventListener('added',(item)=>{
            this.listContainer.addChildElement(new ListRenderer(item));
        });

        this.collection.addEventListener('loaded',(item)=>{
            this.listContainer.hideLoader();
            this.listContainer.layoutChildElements(this.listContainer.currentBounds,true);
        });



        $("body").append(this.canvas.render());

        this.canvas.addRootElement(this.listContainer);

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

class SlideCanvas extends EventDispatcher {
    render() {
        this.$el = $("<div/>").addClass("canvas");

        this.dispatchEvent('rendered', {type: 'rendered'});

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

class BaseElement extends EventDispatcher{
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

class ListRenderer extends BaseElement {

    constructor(data) {
        super();
        this.data = data;
        this.label = data.name;
        this.planetInfo = null;

        this.data.addEventListener('planetLoaded',(info)=>{
            this.planetInfo = info;
            this.$el.text(this.label +" is from "+this.planetInfo.name);
        });
    }

    render() {
        this.$el = $("<li/>");
        this.$el.addClass("element renderer");

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
            this.dispatchEvent("itemRemove",this.data);
        });

    }
}

class ListContainer extends BaseElement {

    constructor() {
        super();
        this.childElements = [];
        this.allCreatedElementCount = 1;
    }


    render() {
        this.$el = $("<ul/>");
        this.$el.addClass("element");
        return this.$el;
    }

    layoutChildElements(bounds, animate) {
        this.childElements.forEach((element, index, arr) => {
            var padding = 50;
            var gap = 10;
            var elementHeight = (bounds.height - 2*padding - gap*(arr.length-1)) / arr.length;
            var elementWidth = bounds.width - 2*padding;
            var elementBounds = {
                left: padding,
                top: padding + index*(elementHeight+gap),
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

    deleteAllChildElement() {
        this.$el.empty();
        this.childElements = [];
        this.renderUI();
        this.layoutChildElements(this.currentBounds,true);
    }

    addChildElement(element) {
        this.childElements.push(element);
        element.parentElement = this;
        this.$el.append(element.render());
        element.renderUI();
        this.allCreatedElementCount++;

        element.addEventListener("itemRemove",event=>{
            this.deleteChildElement(element);
        });

        element.$el[0].addEventListener("click",event=>{
            if(!element.planetInfo)
                this.dispatchEvent("itemClick",element.data);
        });
    }

    hideLoader(){
        this.$loader.hide();
    }

    debounce(fn, wait){
      let timeout;
      return function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, arguments), (wait || 1));
      }
    }

    showLoader(){
        this.$loader.show();
    }

    renderUI() {
        this.$loader = $("<div/>").addClass("loader").text("Summoning Star Wars Citizens...");
        this.$el.append(this.$loader);

        let $searchInput = $("<input type='text' placeholder='search'/>").addClass("search").val(this.searchString);

        this.$el.append($searchInput);

        let $prev = $("<button/>").addClass("prev").text("<");
        this.$el.append($prev);

        let $next = $("<button/>").addClass("next").text(">");
        this.$el.append($next);


        $next.on('click',this.debounce(event=>{
            this.searchString = event.target.value;
            this.dispatchEvent("nextPage",this.searchString );
        },600));

        $prev.on('click',this.debounce(event=>{
            this.searchString = event.target.value;
            this.dispatchEvent("prevPage",this.searchString );
        },600));

        $searchInput.on('keyup',this.debounce(event=>{
            this.searchString = event.target.value;
            this.dispatchEvent("search",this.searchString );
        },600));
    }

}

