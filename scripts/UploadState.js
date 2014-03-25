/*
 * Copyright (c) 2014 Brent Gardner
 * Licensed under the MIT license.
 */
var UploadState = function() {
    var BANDWIDTH_SAMPLE_COUNT = 10;

    var NAME_KEY = 'filename';
    var MIME_KEY = 'mimeType';
    var POSITION_KEY = 'position';
    var DATA_KEY = 'data';

    var self = {};

    var data = null;
    var chunkSize = null;
    var startTime = null;
    var bytesPerSecond = new RingBuffer(BANDWIDTH_SAMPLE_COUNT);

    var id;
    var fileSize = 0;
    var running = false;

    self.clear = function() {
        data = null;
        store.del(DATA_KEY);
        store.del(NAME_KEY);
        store.del(POSITION_KEY);
        store.del(MIME_KEY);
    };

    self.getId = function() {
        if (!id) id = self.makeid();
        return id;
    }

    // ---------------------------------------------------- Data ------------------------------------------------------

    self.getData = function() {
        if (data === null) {
            var base64 = store.get(DATA_KEY);
            if (!base64) {
                return null;
            }
            try {
                data = exports.decode(base64);
            } catch (ex) {
                data = null;
                console.log('Error parsing data, state was corrupted: ' + ex)
            }
        }
        return data;
    };

    self.setData = function(value) {
        data = value;
        var base64 = exports.encode(data);
        store.set(DATA_KEY, base64);
    };

    self.getLength = function() {
        var data = self.getData();
        if (data === null) {
            return 0;
        }
        return data.byteLength;
    };

    // ----------------------------------------------- Calculations ---------------------------------------------------

    self.getRatio = function() {
        if (self.getLength() === 0) {
            return 0;
        }
        return self.getPosition() / self.getLength();
    };

    self.getPercent = function() {
        return self.getRatio() * 100;
    };

    self.getPercentText = function() {
        return self.getPercent() + "%";
    };

    // ------------------------------------------- Persistent state ---------------------------------------------------
    self.getPosition = function() {
        var value = store.get(POSITION_KEY);
        if (!value) {
            return 0;
        }
        return parseInt(value);
    };

    self.setPosition = function(value) {
        store.set(POSITION_KEY, value);
    };

    self.setFilesize = function(size) {
        fileSize = size;
    }

    self.getFilesize = function() {
        return fileSize;
    }


    self.getFilename = function() {
        return store.get(NAME_KEY);
    };

    self.setFilename = function(value) {
        store.set(NAME_KEY, value);
    };


    self.getMimeType = function() {
        var value = store.get(MIME_KEY);
        if (!value || value == '') {
            return 'application/octet-stream';
        }
        return value;
    };

    self.setMimeType = function(value) {
        store.set(MIME_KEY, value);
    }

    self.isRunning = function() {
        return (running);
    }

    // -------------------------------------------- Transient state ---------------------------------------------------
    self.startUpload = function(size) {
        chunkSize = size;
        startTime = new Date().getTime();
        running = true;
    };

    self.endUpload = function() {
        var end = new Date().getTime();
        var elapsedMs = end - startTime;
        var elapsedSec = elapsedMs / 1000;
        bytesPerSecond.add(Math.round(chunkSize / elapsedSec));
        running = false;
    }

    self.getBytesPerSecond = function() {
        return bytesPerSecond.average();
    }

    self.getBitsPerSecond = function() {
        return self.getBytesPerSecond() * 8;
    }

    self.getKbps = function() {
        return Math.round(self.getBitsPerSecond() / 1024);
    }

    self.getMpbs = function() {
        return Math.round(self.getKbps() / 1024);
    }

    self.makeid = function() {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < 5; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        NAME_KEY = text + '_' + NAME_KEY;
        MIME_KEY = text + '_' + MIME_KEY;
        POSITION_KEY = text + '_' + POSITION_KEY;
        DATA_KEY = text + '_' + DATA_KEY;
        return text;
    }

    return self;
}