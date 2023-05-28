<?php
	$dh = opendir(__DIR__);
	while (($file = readdir($dh)) !== false){
		if (preg_match('!^\d+_UNKNOWN.png$!', $file)){
			echo "<img src=\"$file\">\n";
		}
	}
	closedir($dh);
