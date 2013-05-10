
/*
* @description EasyCanvas is a tiny Framework for canvas drawing, game and animation building,
*               which is require Underscore and BackBone for Model and Event
* @author james.li0122@gmail.com
* @latest update 2013.5         
*/


(function() {

  var EC = {};

  //DOM Event
  var DOMEvent = {
    _uid: 1,

    add: function(elm, type, fn) {
      if (!fn._uid) fn._uid = this._uid++;

      if (!elm.events) elm.events = {};

      var handlers = elm.events[type];
  
      if (!handlers) {
        handlers = elm.events[type] = {};
        
        if (elm["on" + type]) {
          handlers[0] = elm["on" + type];
        }
      }
      
      handlers[fn._uid] = fn;
      
      elm["on"+type] = this.handle;
    },

    handle: function(event) {
      var returnValue = true;

      event = event || DOMEvent.fixIE(window.event);
      
      var handlers = this.events[event.type];
      
      for (var i in handlers) {
        this._handler = handlers[i];
        if (this._handler(event) === false) {
          returnValue = false;
        }
      }
      
      return returnValue;
    },

    fixIE: function(event) {
      event.stopPropagation = function() {
        this.cancelBubble = true;
      };
      
      event.preventDefault = function() {
        this.returnValue = false;
      };
      
      return event;
    },

    del: function(elm, type, fn) { 
      if (elm.events && elm.events[type]) {
        delete elm.events[type][fn._uid];
      }
    }
  };



  // common detect
  var IsType = {
    toString: Object.prototype.toString,
    isObject: function(o) {
      return this.toString.call(o) === "[object Object]";
    },
    isFunction: function(o) {
      // some native function (e.g. alert) not pass the test
      return this.toString.call(o) === "[object Function]";
    },
    isString: function(o) {
      return this.toString.call(o) === "[object String]";
    },
    isArray: function(o) {
      return this.toString.call(o) === "[object Array]";
    }
  };




  //get/set currentTransform via methods, add rotate, flip methods

  function _enhanceCTX(ctx) {
    var proto = ctx.constructor.prototype;
  
    ctx.currentTransform = [1, 0, 0, 1, 0, 0];
    ctx.transformStore = [];
    
    ctx.setTransform = function() {
      proto.setTransform.apply(this, arguments);
      ctx.currentTransform = Array.prototype.slice.call(arguments, 0);
    };
    
    ctx.transform=function() {
      proto.transform.apply(this, arguments);
      //matrix multiply
      var m = ctx.currentTransform;
      var n = arguments;
      ctx.currentTransform = mtxMultiply(m,n);
    };
    
    ctx.translate = function() {
      proto.translate.apply(this, arguments);
      ctx.currentTransform[4] += arguments[0];
      ctx.currentTransform[5] += arguments[1];
    };
    
    ctx.scale = function() {
      proto.scale.apply(this, arguments);
      ctx.currentTransform[0] *= arguments[0];
      ctx.currentTransform[3] *= arguments[1];
    };
    
    ctx.rotate = function() {
      proto.rotate.call(this, arguments[0]);
      var sin = Math.sin(arguments[0]);
      var cos = Math.cos(arguments[0]);
      var m = ctx.currentTransform;
      var n = [cos, sin, -sin, cos, 0, 0];
      ctx.currentTransform = mtxMultiply(m, n);
    };
    
    ctx.save = function() {
      proto.save.call(this);
      ctx.transformStore.push(ctx.currentTransform.slice(0));
    };
    
    ctx.restore = function() {
      proto.restore.call(this);
      if(ctx.transformStore.length>0)
        ctx.currentTransform = ctx.transformStore.pop();
    };
    
    //1pxfix
    ctx.transform(1, 0, 0, 1, 0.5, 0.5);
  
    /**
      * draw rotate and flips
      */
    //center rotate
    ctx.centerRotate = function(angle, cx, cy) {
        var r = Math.sqrt(cx * cx + cy * cy);
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        var dx = cx * cos + cy * sin;
        var dy = cy * cos - cx * sin;
        
        this.rotate(angle);
        this.translate(-cx, -cy)
        this.translate( dx, dy);
    };
    // flip horizontal
    ctx.flipH = function(cx) {
        this.translate(cx, 0);
        this.scale(-1, 1);
        this.translate(-cx, 0);
    };
    // flip vertical
    ctx.flipV = function(cy) {
        this.translate(0, cy);
        this.scale(1, -1);
        this.translate(0, -cy);
    };

    //two transform matrix multiply
    function mtxMultiply(m,n) {
      var a = m[0] * n[0] + m[1] * n[2],
          b = m[0] * n[1] + m[1] * n[3],
          c = m[2] * n[0] + m[3] * n[2],
          d = m[2] * n[1] + m[3] * n[3],
          e = m[4] * n[0] + m[5] * n[2] + n[4],
          f = m[4] * n[1] + m[5] * n[3] + n[5];
      
      return [a, b, c, d, e, f];
    }

    //two transform matrix division
    function mtxDivision(v,m){
      var x = (m[3] * (v[0] - m[4]) - m[2] * (v[1] - m[5]))/(m[0] * m[3] - m[1] * m[2]),
          y = (m[0] * (v[1] - m[5]) - m[1] * (v[0] - m[4]))/(m[0] * m[3] - m[1] * m[2]);
      return [x, y];
    }

    // 创建用于保存图形数据的存储器
    ctx.graphs = [];
  }



  //Viewport

  var Viewport = Backbone.Model.extend({
    width: 200,
    height: 200,
    domId: 'viewport',
    initialize: function() {
      this.elm = document.getElementById(this.domId);
      this.initPos();
      this.posEvents();
    },

    initPos: function() {
      function pageX(elm) {
        return elm.offsetParent ? 
        pageX(elm.offsetParent) + elm.offsetLeft : elm.offsetLeft;
      }

      function pageY(elm) {
        return elm.offsetParent ? 
        pageY(elm.offsetParent) + elm.offsetTop : elm.offsetTop; 
      }
      this.ox = pageX(this.elm);
      this.oy = pageY(this.elm);
    },

    posEvents: function() {

      var This = this;

      DOMEvent.add(window, 'scroll', _fixScroll);
      DOMEvent.add(window, 'load', _fixScroll);
      DOMEvent.add(window, 'resize', _fixScroll);
      DOMEvent.add(this.elm, 'mousemove', _setPos);
      DOMEvent.add(this.elm, 'mouseout', _clearPos);

      function _fixScroll() {
        This.clientX = This.ox - document.documentElement.scrollLeft;
        This.clientY = This.oy - document.documentElement.scrollTop;
      }

      function _setPos(e) {
        if (This.x) {
          This.x0 = This.x;
          This.y0 = This.y;
        }

        _fixTouch(e);

        This.x = e.clientX - This.clientX;
        This.y = e.clientY - This.clientY;
      }

      function _clearPos(e) {
        delete This.x;
        delete This.y;
      }

      function _fixTouch(e) {
        // make clientX and Y compatible to touch event
        // notice: reset e.clientX,Y in desktop opera will throw exception, so should put it in if statement.
        if (e.touches) {
          e.clientX = e.touches[0].clientX;
          e.clientY = e.touches[0].clientY;
        }
      }
    }
  });





  //Layer
  var Layer = Backbone.Model.extend({

    initialize: function() {
      // init viewport
      if (!Layer.viewport) {
        Layer.viewport = new Viewport;
      }

      this.create();
    },

    create: function() {
      this.canvas = document.createElement('canvas');
      Layer.viewport.elm.appendChild(this.canvas);
      this.canvas.width = Layer.viewport.width;
      this.canvas.height = Layer.viewport.height;
      this.canvas.id = 'ec_' + this.cid;
      this.ctx = this.canvas.getContext('2d');
      _enhanceCTX(this.ctx);
    }

  });





  //Graph
  var Graph = Backbone.Model.extend({

    initialize: function(o) {
      if (IsType.isObject(o)) {
        for (var i in o) {
          if (o.hasOwnProperty(i))
            this[i] = o[i];
        }
      }

      // 绘制一个识别层用于图形的event判断
      if (!Graph.detecter) {
        Graph.detecter = new Layer;
      }
      

      //events
      this.events();
    },

    render: function(ctx, type) {

      if (!this.ctx) {
        this.ctx = ctx;
        this.renderType = type;
        this.ctx.graphs.push(this);
      }
      
      this._createPath(this.ctx);
      this._renderType(this.ctx, this.renderType);

      return this;
    },

    reRender: function() {
      var graphs = this.ctx.graphs,
          len = graphs.length,
          i = 0;

      this.ctx.clearRect(0, 0, Layer.viewport.width, Layer.viewport.height);

      for (; i < len; i++) {
        graphs[i].render();
      }
    },

    _createPath: function(ctx) {
      ctx.beginPath();

      this.path(ctx);
    },

    _renderType: function(ctx, type) {
      var args = arguments, This = this;
      if (IsType.isString(type) && IsType.isFunction(ctx[type])) {
        ctx[type]();
      } else if (IsType.isArray(type)) {
        type.forEach(function(v) {
          args.callee.call(This, ctx, v);
        })
      }
    },

    events: function() {
      var viewport = Layer.viewport,
          ctx = Graph.detecter.ctx,
          This = this;

      this._normalBind(viewport, ctx, This);
      this._specBind(viewport, ctx, This);

      if (this.dragMode === 'normal') {
        this._normalDrag();
      }
    },

    _normalBind: function(viewport, ctx, This) {
      var normalEvents = ["click", "dblclick", "mousedown", "mouseup",
                      "touchstart", "touchmove", "touchend", "touchcancel"];

      normalEvents.forEach(function(v) {
        DOMEvent.add(viewport.elm, v, function(e) {

          // 在识别层上重绘制取path
          This._createPath(ctx);
          if (ctx.isPointInPath(viewport.x, viewport.y)) {
            This.trigger(v);
            if (v === 'mousedown' && This.draggable) {
              This.dragging = true;
            }
            if (v === 'mouseup') {
              This.dragging = false;
            }
          }
        });
      });
    } ,

    //mouseover等需要通过viewport的mousemove判断的事件
    _specBind: function(viewport, ctx, This) {
      DOMEvent.add(viewport.elm, 'mousemove', function(e) {
        
        This._createPath(ctx);
        if (ctx.isPointInPath(viewport.x, viewport.y)) {
          This._handleDrag(viewport);
          if (This.msover) {
            This.trigger('mousemove');
          } else {
            This.msover = true;
            This.trigger('mouseover');
            This.trigger('mouseenter');
          }
        } else if (This.msover) {
          delete This.msover;
          This.trigger('mouseout');
          This.trigger('mouseleave');
        }

      });

      DOMEvent.add(viewport.elm, 'mouseout', function(e) {
        This.dragging = false;
      });
    },

    _handleDrag: function(viewport) {
      var dx = viewport.x - viewport.x0,
          dy = viewport.y - viewport.y0;

      if (this.dragging) {
        //out of viewport
        if (!viewport.x || !viewport.y) {
          return;
        }

        this.trigger('dragging', dx, dy);
      }
    },

    _normalDrag: function() {
      this.on('dragging', function(dx, dy) {
        this.x += dx;
        this.y += dy;
        this.reRender();
      });
    }

  });

  EC.Layer = Layer;
  EC.Graph = Graph;

  window.EC = EC;


})(Backbone);