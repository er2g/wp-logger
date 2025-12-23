<?php
$indexPath = __DIR__ . '/index.html';

if (is_file($indexPath)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($indexPath);
    exit;
}

http_response_code(500);
echo 'Missing index.html';
