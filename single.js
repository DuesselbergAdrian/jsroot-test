// this is just for speical testing of single object 

var jsroot = require("jsroot");
var fs = require("fs");

var filename =  "http://jsroot.gsi.de/files/histpainter6.root",
    itemname = "draw_hstack";

jsroot.OpenFile(filename, function(file) {
   file.ReadObject(itemname, function(obj) {
      // var subpad = obj.fPrimitives.arr[2];
      var subpad = obj;
      jsroot.MakeSVG( { object: subpad, width: 1200, height: 800 }, function(svg) {
         fs.writeFileSync("single.svg", svg);
         console.log('create single.svg file size', svg.length);
      });
      
   });
});
