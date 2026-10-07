#!/bin/sh
echo "SHIM CALLED: $@" >> /tmp/gh-shim-966/calls.log
sleep 6
exit 1
