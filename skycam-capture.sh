#!/bin/bash


RASPISTILL=/usr/bin/raspistill
RAWDIR=/home/pi/skycam/raw;
FREQUENCY=4
QUALITY=50
HEIGHT=1024
WIDTH=1280

while true 
do

	RUNID=$(( $RANDOM % 9999 ));
	
	EXEC="$RASPISTILL -hf -vf -w $WIDTH -h $HEIGHT -q $QUALITY -ex verylong -mm matrix -awb auto -t 0 -tl $(($FREQUENCY*1000)) -o $RAWDIR/skyshot_$RUNID-%d.jpg"
		
	echo "Executing: $EXEC"
	eval $EXEC
done
