(function(){
    function FitrPixel(pixelArray, x, y) {
        this.r = pixelArray[0];
        this.g = pixelArray[1];
        this.b = pixelArray[2];
        this.a = pixelArray[3]/255.0;
        this.x = x;
        this.y = y;
        delete pixelArray;
    }
    FitrPixel.prototype.toHEX = function () {
        if(this.a === 0) return "transparent";
        return "#"
             + String("00"+this.r.toString(16)).slice(-2)
             + String("00"+this.g.toString(16)).slice(-2)
             + String("00"+this.b.toString(16)).slice(-2);
    };
    FitrPixel.prototype.toRGBA = function () {
        return "rgba("
                +this.r+','
                +this.g+','
                +this.b+','
                +this.a+')';
    };

    function Fitr(img, onReady, filters, normalizers) {
        var self = this;
        this.img = img;
        this.canvas = undefined;
        this.imageData = undefined;

        this._normalizers = normalizers || [Fitr.normalizer.alpha(1)];
        this._filters = filters || [Fitr.filters.alpha(1)];

        var callback = function() {
            onReady.call(self);
        };

        if(img.complete) {
            callback();//direct call
        }
        else if(img.addEventListener) {
            img.addEventListener('load', callback);
        }
        else if(img.attachEvent) {
            img.attachEvent('onload', callback);
        }
        else {
            throw "could not attach load listener";
        }
    }

    Fitr.prototype.normalize = function (pixel) {
        for (var i = 0; i < this._normalizers.length; i++) {
            if( typeof this._normalizers[i] === 'function' ) {
                pixel = this._normalizers[i](pixel);
            }
        }
        return pixel;
    };

    Fitr.prototype.clean = function () {
        this.canvas = undefined;
        this.imageData = undefined;
    };

    Fitr.prototype.filter = function (pixel) {
        for (var i = 0; i < this._filters.length; i++) {
            if( typeof this._filters[i] === 'function' ) {
                if(!this._filters[i](pixel)) {
                    return false;
                }
            }
        }
        return true;
    };

    Fitr.prototype.getImageData = function () {
        if(!this.imageData) {
            if(!this.canvas) {
                this.canvas = document.createElement('canvas');
            }
            var ctx = this.canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            this.canvas.width = this.img.width;
            this.canvas.height = this.img.height;
            ctx.drawImage(this.img, 0, 0);
            this.imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
        return this.imageData;
    };

    Fitr.prototype.getHeight = function () {
        return this.img.height;
    };

    Fitr.prototype.getWidth = function () {
        return this.img.width;
    };

    Fitr.prototype.getBorderColors = function (border) {
        if(!border) border = 1;
        var total = this.getDistribution(this.getBorderPixels(border));
        var colors = new Array(total.length);
        for (var i = total.length - 1; i >= 0; i--) {
            colors[i] = total[i].mean;
        };
        return colors;
    };

    Fitr.prototype.getCornerColors = function (depth) {
        if(!depth) depth = 3;
        var total = this.getDistribution(this.getCornerPixels(depth));
        var colors = new Array(total.length);
        for (var i = total.length - 1; i >= 0; i--) {
            colors[i] = total[i].mean;
        };
        return colors;
    };

    Fitr.prototype.getColors = function () {
        var total = this.getDistribution(this.getAllPixels());
        var colors = new Array(total.length);
        for (var i = total.length - 1; i >= 0; i--) {
            colors[i] = total[i].mean;
        };
        return colors;
    };

    /* image has edge that can be continued? */
    Fitr.prototype.hasEdge = function () {
        var cornerPixels = this.getCornerPixels(1);
        var cornerNonAlpha = 0;
        for (var i = cornerPixels.length - 1; i >= 0; i--) {
            if(cornerPixels[i].a === 1) {
                cornerNonAlpha += 1;
            }
        };
        if(cornerNonAlpha > 3) {
            //if all 4 corners have nonAlpha pixels, edge
            return true;
        }
        else if(cornerNonAlpha < 2) {
            //if only one corner has nonAlpha, no edge
            return false;
        }
        else {
            //somewhere in between, lets check borders
            var borderDepth = 2;
            var borderPixels = this.getBorderPixels(borderDepth);
            var nonAlpha = 0;
            for (var i = borderPixels.length - 1; i >= 0; i--) {
                if(borderPixels[i].a === 1) {
                    nonAlpha += 1;
                }
            };
            return nonAlpha > this.getHeight()*2*borderDepth;
        }
    };

    Fitr.prototype.getAllPixels = function () {
        imageData = this.getImageData();
        var pixelnumbers = new Array(imageData.data.length/4);
        for (var i = imageData.data.length/4 - 1; i >= 0; i--) {
            pixelnumbers[i]=i;
        }
        var pixels = this.getPixels(pixelnumbers);
        return pixels;
    };

    Fitr.prototype.getBorderPixels = function (border) {
        var height = this.getHeight();
        var width = this.getWidth();

        var numbers = [];
        for (x=0; x<width; x++) {
            for(y=0; y<height; y++) {
                if((x < border || x > width-border-1)
                   ||
                   (y < border || y > height-border-1)) {
                    numbers.push(y*width+x);
                }
            }
        }
        return this.getPixels(numbers);
    };

    Fitr.prototype.getCornerPixels = function (depth) {
        var height = this.getHeight();
        var width = this.getWidth();

        var numbers = [];
        for (var i=0; i < depth; i++) {
            for(var j=0; j < i+1; j++) {
                //top left corner
                var tl = i+j*width-j;
                //bottom left corner
                var bl = ((height-1-i)*width)+j*width+j;
                //top right corner
                var tr = width-1-i+j*width+j;
                //bottom right corner
                var br = (width-1-i+(height-1)*width)-j*width+j;

                //add to numbers array
                if(numbers.indexOf(tl) === -1)
                    numbers.push(tl);
                if(numbers.indexOf(tr) === -1)
                    numbers.push(tr);
                if(numbers.indexOf(bl) === -1)
                    numbers.push(bl);
                if(numbers.indexOf(br) === -1)
                    numbers.push(br);
            }
        };
        return this.getPixels(numbers.sort());
    };

    Fitr.prototype.getPixels = function (pixels) {
        if(!(pixels instanceof Array)) {
            throw "first argument should be instance of array";
        }
        var imageData = this.getImageData();
        var out = new Array();
        for (var i = 0; i < pixels.length; i++) {
            var pixel = new Array(4);
            for (var j = 0; j < 4; j++) {
                pixel[j] = imageData.data[pixels[i]+j];
            };
            var pixel = new FitrPixel(
                        pixel, //pixel array
                        pixels[i] % imageData.width,//x
                        Math.floor(pixels[i] / imageData.width)//y
                    );
            pixel = this.normalize(pixel);
            if(this.filter(pixel)) {
                out.push(pixel);
            }
        };
        return out;
    };

    /**
     * count number of occurrences of pixels as hashed by the hashPixel function
     * returns a sorted array of objects with the hash,mean and count properties
     */
    Fitr.prototype.getDistribution = function (pixels) {
        var distribution = {};
        var hashPixel = function(p){
            return p.toRGBA();
        };
        for (var i = pixels.length - 1; i >= 0; i--) {
            var hash = hashPixel(pixels[i]);
            if(!(hash in distribution)) {
                distribution[hash] = [];
            }
            distribution[hash].push(pixels[i]);
        };
        var out = new Array();
        for (hash in distribution) {
            if(distribution[hash].length > 1) {
                out.push({
                    'hash': hash,
                    'mean': distribution[hash][0],
                    'all': distribution[hash],
                    'count': distribution[hash].length
                });
            }
        }
        return out.sort(function(a,b){
            return b.count - a.count;
        });
    };


    Fitr.normalizer = {
        //flatten out the alpha transparency. 
        //if value is above threshold, alpha is set to 1
        //if value is below threshold, alpha is set to 0
        alpha: function(threshold) {
            return function(pixel) {
                if(pixel.a >= threshold)
                    pixel.a = 1;
                else
                    pixel.a = 0;
                return pixel;
            };
        }
    };
    Fitr.filters = {
        alpha: function(threshold) {
            return function(pixel) {
                return pixel.a >= threshold;
            };
        }
    };

    /*
        if requirejs is present, define Fitr with requirejs' define
        else bind to window
    */
    if(window.define && window.define instanceof Function) {
        define(function(){
            return Fitr;
        });
    }
    else {
        window.Fitr = Fitr;
    }
}());