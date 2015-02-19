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

var hoursAgo = getHourAgo(process.argv[2] ? process.argv[2] : 1);

var targetDate = formatDateHour(hoursAgo);

console.log('Processing timestamp:', hoursAgo, '[targetDate: ' +  targetDate + ']');

queryDiskImages(rawDir, targetDate, function(targetImages) {
				
	if (targetImages.length > 0) {
		
		// Write out our render-index
		console.log('> Generating and writting render-index..');
		var renderIndexPath = buildAndWriteRenderIndex(targetImages, targetDate);
		
		// Render our video
		renderVideo(renderIndexPath, targetDate, function(renderOutputPath) {
		
			// Delete target images
			deleteTargetImages(targetImages);
		
			// Submit video to skycloud
			shipToSkycloud(targetDate, renderOutputPath, function() {

				// Delete locally rendered video
				deleteVideo(renderOutputPath);

			});
		
		});
	
	} else {
		console.log("Not enough targetImages(0) to continue.. exiting.");
	}
  
});

function queryDiskImages(rawDir, targetDate, callback) {
	var targetImages = [];

	fs.readdir(rawDir, function (err, imagesRaw) {

		var images = [];
		imagesRaw.forEach(function(imgName) {
			if(path.extname(imgName) === ".jpg")
				images.push(rawDir + "/" + imgName);
		});
		
		console.log("Found a total of", imagesRaw.length, "images in raw bin.");
		
		// Grab File Stat for each image
		async.map(images, fs.stat, function(err, statResults) {
			if (err) console.log("FS.STAT ERROR: ", err);
			
			// Build our targetImages array (from images captured within our targetdate)
			for (var idx in images) {
				var stat = statResults[idx];
				
				if (stat && stat.ctime &&
					formatDateHour(stat.ctime) == targetDate
				) {
					targetImages.push(images[idx]);
				}
			}
			
			console.log("Out of", imagesRaw.length, "raw images,", targetImages.length, "matched targetDate and were selected.");
			
			// return with targetImages
			callback(targetImages);
			
		});
	});
	
}

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

function buildAndWriteRenderIndex(targetImages, targetDate) {
	var renderListPath = [renderIndexDir, targetDate + ".txt"].join('/');
	
	var renderListContent = targetImages.join("\n");
	
	fs.writeFileSync(renderListPath, renderListContent);

	return renderListPath;
}


function renderVideo(renderIndexPath, targetDate, callback) {

	var renderOutputPath = renderDir + "/" + targetDate + ".avi";

	console.log('> Rendering Video - target:', renderOutputPath);
	
	var mencoderArgs = [
		 '-nosound',
		 '-ovc lavc',
		 '-lavcopts vcodec=mpeg4:vbitrate=8000000',
		 '-vf scale=1280:1024',
		 '-o "'+renderOutputPath+'"',
		 '-mf type=jpeg:fps=24',
		 'mf://@' + renderIndexPath
	]
	var execStr = "mencoder " + mencoderArgs.join(' ');
	
	console.log('> Executing Child Process:', execStr);
	
	var child = exec(execStr, function(err, stdout, stderr) {
        if (err) throw err;
        
        console.log(" >> Video Rendering Complete!");
        
        // TODO: Don't assume everything worked!
        
        callback(renderOutputPath);
    });
	
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

function deleteTargetImages(targetImages) {
	console.log('> deleting ' + targetImages.length + ' images from disk..');
	targetImages.forEach(function(imagePath) {
		// Delete image from disk
		fs.unlinkSync(imagePath);
	});
	return true;
}

function deleteVideo(targetVideo) {
	return fs.unlinkSync(targetVideo);
}

function formatDateHour(timestamp) {
	var isoFormat = new Date(timestamp).toISOString();
	var yearMonthDay = isoFormat.substr(0, 10);
	var hour = isoFormat.substr(11, 2);
	return yearMonthDay + "_" + hour;	
}

function getHourAgo(hoursAgo) {
	var hoursAgo = hoursAgo || 1;
	var today = new Date();
	return new Date(today.getTime() - ((1000*60*60) * hoursAgo));
}