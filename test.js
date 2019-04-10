var jsroot = require("jsroot");
var fs = require("fs");
// var seedrandom = require('seedrandom');

require("./../jsroot/demo/examples.js");

console.log('JSROOT version', jsroot.version);

var init_style = null,
    test_mode = "verify", nmatch = 0, ndiff = 0, nnew = 0,
    keyid = 'TH1', theonlykey = false, optid = -1, theonlyoption = -100, itemid = -1, 
    entry, entry_name = "", testfile = null, testobj = null;  

if (process.argv && (process.argv.length > 2)) {
   
   for (var cnt=2;cnt<process.argv.length;++cnt)
      switch (process.argv[cnt]) {
        case "-v":
        case "--verify":  test_mode = "verify"; break; 
        case "-c":
        case "--create": test_mode = "create"; break; 
        case "-k":
        case "--key":
           keyid = process.argv[++cnt];
           theonlykey = true;
           if (!keyid || !examples_main[keyid])
              return console.log('Key not found', keyid);
           break; 
        case "-o":
        case "--opt":
           theonlyoption = parseInt(process.argv[++cnt]);
           if (isNaN(theonlyoption) || (theonlyoption<0) || !examples_main[keyid][theonlyoption])
              return console.log('wrong option for key', keyid);
           
           console.log('Select option', examples_main[keyid][theonlyoption], 'for key', keyid);
           break;
        case "-m":
        case "--more":
           require("./../jsroot/demo/examples_more.js");
           
           for (var key in examples_more) {
              if (key in examples_main) {
                 for (var n in examples_more[key])
                    examples_main[key].push(examples_more[key][n]);
              } else {
                 examples_main[key] = examples_more[key];
              }
           }
           
           break;

   
        default:
           console.log('Usage: node test.js [options]');
           console.log('   -v | --verify : check stored content against current JSROOT version');
           console.log('   -c | --create : perform checks and overwrite when results differ');
           console.log('   -k | --key  keyname : select specific key (class name) like TH1 or TProfile for testing');
           console.log('   -m | --more : use more tests');
           return;
      }
} 

function ProduceGlobalStyleCopy() {
   // copy style when painter is loaded
   if (!init_style && jsroot.Painter) init_style = jsroot.gStyle;
}

function ProduceFile(content, extension) {
   if (!entry_name) entry_name = keyid;
   
   entry_name = entry_name.replace(/\+/g,'p').replace(/\>/g,'more')
                          .replace(/\</g,'less').replace(/\|/g,'I')
                          .replace(/\[/g,'L').replace(/\]/g,'J').replace(/\*/g,'star');
   
   // in older node.js fs.constants not exists
   var w_ok = fs.constants ? fs.constants.W_OK : fs.W_OK;
   
   fs.access(keyid, w_ok, function(dir_err) {
      
      if (dir_err) fs.mkdirSync(keyid);
      
      var svgname = keyid + "/" + entry_name + extension,
          svg0 = null, result = "MATCH";
      
      try {
        svg0 = fs.readFileSync(svgname, 'utf-8');
        if (svg0 != content) result = "DIFF";
      } catch(e) {
        svg0 = null;
        result = "NEW"; 
      }
      
      switch (result) {
         case "NEW": nnew++; break;
         case "DIFF": ndiff++; break;
         default: nmatch++;
      }

      var clen = content ? content.length : -1;
      console.log(keyid, entry_name, 'result', result, 'len='+clen, (svg0 && result=='DIFF' ? 'rel0='+(clen/svg0.length*100).toFixed(1)+'\%' : ''));

      if ((result === "NEW") || ((test_mode === 'create') && (result!=='MATCH'))) {
         if (clen > 0)
            fs.writeFileSync(svgname, content);
         else if (result !== "NEW") 
            fs.unlink(svgname);
      }
      
      ProcessNextOption();
   });
}


function ProduceSVG(obj, opt) {

   // use only for object reading
   if ((theonlyoption>=0) && theonlyoption!==optid)
      return ProcessNextOption();
   
   jsroot.MakeSVG( { object: obj, option: opt, width: 1200, height: 800 }, function(svg) {
      ProduceFile(svg, ".svg");
   });
}

function ProduceJSON(tree, opt, branchname) {
   if (!tree) return ProcessNextOption();
   
   var args = { expr: opt, dump: true };
   if (branchname) {
      if (branchname === "/Event/Gen/Header/m_evtNumber") branchname = "/Event/Gen/Header.m_evtNumber"; // workaround
      args.branch = tree.FindBranch(branchname);
   }

   tree.Draw(args, function(res) {
      if (res) res = JSON.stringify(res); else res = "<fail>";
      ProduceFile(res, ".json");
   });
}


function ProcessNextOption() {

   if (!keyid) {
      console.log('No more data to process');
      console.log("SUMMARY: match", nmatch, "diff", ndiff, "new", nnew);
      return;
   }
   
   var opts = examples_main[keyid];
   if (!opts) return;
   
   if ((itemid>=0) || (itemid==-2)) {
      if (itemid==-2) itemid = -1; // special workaround for style entry, which is marked as itemid=-2
      if (++itemid>=opts[optid].items.length) itemid = -1;
   }
   
   if (itemid<0) { // first check that all items are processed
      if (theonlyoption == optid) {
         keyid = null;
         return ProcessNextOption();
      }
      if (++optid>=opts.length) {
         optid = -1;
         var found = false, next = null;
         for (var key in examples_main) {
            if (key === "TGeo") continue; // skip already here
            if (found) { next = key; break; }
            if (key == keyid) found = true;
         }

         keyid = next;
         if (theonlykey) keyid = null;
         return ProcessNextOption();
      }
   }
   
   entry = opts[optid];
   
   entry_name = "";

   // exclude some entries from the test
   if (entry.notest) return ProcessNextOption();
   
   var filename = "", itemname = "", itemfield = "", jsonname = "", url = "", opt = "",
       filepath = "http://jsroot.gsi.de/files/";
//       filepath = "https://root.cern.ch/js/files/";
   
   if (entry.file) {
       filename = entry.file;
       if ((filename.indexOf("http:")<0) && (filename.indexOf("https:")<0)) filename = filepath + filename; 
   }
   if (entry.item) {
      itemname = entry.item;
      if (entry.itemfield) { itemfield = entry.itemfield; itemname = itemname.substr(0, itemname.length - itemfield.length - 1); } 
   }
   if (entry.testopt !== undefined) opt = entry.testopt; else if (entry.opt) opt = entry.opt;
   if (entry.json) {
      jsonname = entry.json;
      if ((jsonname.indexOf("http:")<0) && (jsonname.indexOf("https:")<0)) jsonname = filepath + jsonname;
   }
   if (entry.items) {
      if (itemid<0) {
         
         if ((itemid==-1) && entry.style) {
            itemid = -2;
            itemname = entry.style; // special case when style should be applied before objects drawing  
         } else {
           itemid = 0;
         }
      }
      if (itemid>=0) {
         itemname = entry.items[itemid];
         if (entry.opts && (itemid < entry.opts.length)) opt = entry.opts[itemid];
      }
   }
   
   if (entry.url) url = entry.url.replace(/\$\$\$/g, filepath); else
   if (entry.asurl) {
      url = ((entry.asurl === "browser") ? "?" : "?nobrowser&");
      url += jsonname ? "json=" + jsonname : "file=" + filename + "&item=" + itemname;
      url += itemname + "&opt=" + opt;
   }
   
   if ((opt=='inspect') || (opt=='count')) return ProcessNextOption();

   if (itemid >= 0)
      entry_name = (entry.name || keyid) + "_" + itemname + (opt ? "_" + opt : "");
   else
   if ('name' in entry)
      entry_name = entry.name;
   else
      entry_name = opt ? opt : keyid;

   ProduceGlobalStyleCopy();
   if (!entry.style && init_style) jsroot.gStyle = jsroot.extend({}, init_style);

   // ensure default options
   if (jsroot.Painter) jsroot.Painter.createRootColors(); // ensure default colors
   if (jsroot.gStyle.MathJax!==undefined)
      jsroot.gStyle.MathJax = entry.mathjax ? 1 : 0;
   jsroot.gStyle.Latex = entry.latex ? entry.latex : 2;
   // seedrandom('hello.', { global: true }); // set global random
   jsroot.id_counter = 0; // used in some custom styles
   
   if (keyid === "TTree") {
      if (entry.url || entry.large) return ProcessNextOption(); // ignore direct URL
      jsroot.OpenFile(filename, function(file) {
         var branchname = "", pos = itemname.indexOf(";1//");
         if (pos>0) { branchname = itemname.substr(pos+3); itemname = itemname.substr(0, pos+2); }
         file.ReadObject(itemname, function(tree) {
            ProduceJSON(tree, opt, branchname);
         });
      });
   } else
   if (((url.length > 0) && !entry.asurl)) {   
      testfile = testobj = null;
      return ProcessNextOption();
   } else   
   if (jsonname.length > 0) {
      testfile = testobj = null;
      jsroot.NewHttpRequest(jsonname, 'object', function(obj) {
         testobj = obj;
         ProduceSVG(testobj, opt);
      }).send();
   } else  
   if (filename.length > 0) {
      jsroot.OpenFile(filename, function(file) {
         testfile = file;
         testfile.ReadObject(itemname, function(obj) {
            if (itemid==-2) {
               // special handling of style
               // Check that copy of gStyle exists
               ProduceGlobalStyleCopy();
               // first create copy of existing style
               var newstyle = jsroot.extend({}, jsroot.gStyle);
               // then apply changes to the 
               jsroot.gStyle = jsroot.extend(newstyle, obj);
               return ProcessNextOption();
            } else {
               if (itemfield && obj[itemfield]) obj = obj[itemfield];
               testobj = obj;
               ProduceSVG(testobj, opt);
            }
         });
      });
   } else
   if (itemname.length > 0) {
      testfile.ReadObject(itemname, function(obj) {
         testobj = obj;
         ProduceSVG(testobj, opt);
      });
   } else {
      ProduceSVG(testobj, opt);
   }
}

ProcessNextOption();