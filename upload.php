<?php

// Get the filename header
foreach (getallheaders() as $name => $value) {
    echo "$name: $value\n";
    if($name == 'HTTP_X_FILENAME') {
        $filename = $value;
    }
    if($name == 'Content-Range') {
        $contentRange = $value;
    }
}
$contentRange = str_replace("bytes ", "", $contentRange);

// Get content
$content = file_get_contents('php://input');

// Calculate range
$ar = explode("/", $contentRange);
$range = $ar[0];
$ar = explode("-", $range);
$position = (int)$ar[0];

// Write to file
$fp = fopen('uploads/' . $filename, 'a'); // TODO: Security / access control
fseek($fp, $position);
fwrite($fp, $content);
fclose($fp);

exit();
