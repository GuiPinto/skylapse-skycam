var util  = require('util'),
    fs = require('fs'),
	path = require('path'),
	async = require('async'),
	proc = require('node-proc'),
	exec = require('child_process').exec;
    
var skycamDir = "/home/pi/skycam";
var rawDir = skycamDir + "/raw";
var renderIndexDir = skycamDir + "/render-index";
var renderDir = skycamDir + "/renders";
var skycloudHost = 'http://guipinto.com:5000/skycloud';

fs.readdir(renderDir, function (err, rendersRaw) {

	var renders = [];
	rendersRaw.forEach(function(renderName) {
		if(path.extname(renderName) === ".avi")
			renders.push(renderDir + "/" + renderName);
	});

	async.mapLimit(renders, 1, function(render, cb) {
		var parts = render.split('/');
		var renderDate = parts[parts.length - 1].replace('.avi', '');

		shipToSkycloud(renderDate, render, function() {

			deleteVideo(render);

			cb(null);

		});

	}, function(err) {
		console.log("DONE!");
	});

});


function shipToSkycloud(dateHour, videoPath, callback) {

	var dateHourSplit = dateHour.split('_');
	var date = dateHourSplit[0],
		hour = dateHourSplit[1];
	
	getUniqueId(function(uid) {
	
		console.log('> Shipping to Skycloud - uid:', uid);

		var curlArgs = [
			'--form "video=@' + videoPath + '"',
			'--form date="' + date + '"',
			'--form hour="' + hour + '"',
			'--form uid="' + uid + '"',
			skycloudHost
		];
		var execStr = "curl " + curlArgs.join(' ');
		
		console.log('> Executing Child Process:', execStr);
		var child = exec(execStr, function(err, stdout, stderr) {
	        if (err) throw err;
	        
	        console.log(" >> Skycloud Upload Complete!");
	        callback();

	    });
		
	});
			
}

function deleteVideo(targetVideo) {
	return fs.unlinkSync(targetVideo);
}


function getUniqueId(cb) {
	var uniqueId = '';
	proc.cpuinfo(function(err, cpuinfo) {
		cpuinfo.forEach(function(info) {
			if (uniqueId == '' && info['Serial'])
				uniqueId = info['Serial'];
		});
		return cb(uniqueId);
	});
}
