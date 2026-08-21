<?php
$key = openssl_pkey_new([
    "private_key_bits" => 2048,
    "private_key_type" => OPENSSL_KEYTYPE_RSA,
]);
if (!$key) {
    echo "OpenSSL Error: " . openssl_error_string();
} else {
    echo "OpenSSL works!";
}
