/*
 * Copyright (c) 2014 Brent Gardner
 * Licensed under the MIT license.
 */
var UploadManager = function(options) {
    var self = {};
    var interval;
    var settings = {
        chunkSize: 20 * 1024,
        pollInterval: 250,
        serverPath: "upload.php",
        notifications: false, //show the notification window with file progress.
        appendTo: 'body' //which dom element to append the notifications to
    }

    // Constants
    //var self.settings.chunkSize = 20 * 1024;
    // var self.settings.pollInterval = 250;


    var uploadStates = [];
    self.settings = mergeObjects(settings, options);
    /**
     * Uploads a file to the server
     *
     * @param file The file to upload
     */
    self.upload = function(file) {
        // Save meta data
        var state = new UploadState();
        state.getId();
        uploadStates.push(state);
        state.setFilename(file.name);
        state.setMimeType(file.type);
        state.setFilesize(file.size);
        state.setPosition(0);

        // Read the file from the disk
        var reader = new FileReader();
        reader.onload = function(ev) {
            state.setData(ev.target.result);
        };
        reader.readAsArrayBuffer(file);
        if (self.settings.notifications) {
            buildNotificationWindow(state);
        }
        if (!interval) interval = setInterval(uploadChunk, self.settings.pollInterval);
    };

    // -------------------------------------------- Helper methods ----------------------------------------------------
    var uploadChunk = function() {
        //loop through all our upload states.
        var state;
        if (!uploadStates.length) {
            //console.debug('no states');
            window.onbeforeunload = null;
            clearInterval(interval);
            interval = null;
            return;
        }
        //only load the first state. call one at a time till it's done.
        state = uploadStates[0];

        // Read from local storage
        if (state.getData() === null || state.isRunning()) {
            // console.debug('no data or is running: ' + state.getFilename());
            return; // Nothing to upload!
        }
        //make sure the user is alerted if they try to leave.
        window.onbeforeunload = confirmExit;
        // Calculate next chunk
        var end = Math.min(state.getPosition() + self.settings.chunkSize, state.getLength());
        var chunkSize = end - state.getPosition();
        if (chunkSize <= 0) {
            completeUpload(state);
            return;
        }
        //console.log("Sending " + chunkSize + " bytes " + state.getPosition() + " of " + state.getLength());
        var abv = new Uint8Array(state.getData(), state.getPosition(), chunkSize);

        // Build content-range
        var contentRange = "bytes " + state.getPosition() + "-" + (end - 1) + "/" + state.getLength();

        // Send
        state.startUpload(chunkSize);
        var req = new XMLHttpRequest();

        // Add listeners
        req.addEventListener("progress", function(ev) {
            updateProgress(ev, state);
        }, false);
        req.addEventListener("load", function(ev) {
            transferComplete(ev, state);
        }, false);
        req.addEventListener("error", function(ev) {
            transferFailed(ev, state);
        }, false);
        req.addEventListener("abort", function(ev) {
            transferCanceled(ev, state);
        }, false);

        // Create request
        req.open("POST", self.settings.serverPath, true); // TODO: Use webdav on server, put filename here?

        // Set headers
        req.setRequestHeader('HTTP_X_FILENAME', state.getFilename()); // TODO: Use webdav and remove this line?
        req.setRequestHeader('Content-Range', contentRange);
        req.overrideMimeType(state.getMimeType());

        // Send
        req.send(abv);


    };

    // -------------------------------------------- Status events -----------------------------------------------------
    var updateProgress = function(ev, state) {

        if (self.settings.notifications) {
            item = document.querySelector("[data-upload-state='" + state.getId() + "']");
            progress = item.getElementsByClassName('progress-bar');
            progress[0].style.width = state.getPercent() + '%';
            if (state.getPercent() == 100) {
                progress.parentNode.parentNode.removeChild(progress.parentNode);
            }
        }
    };

    var transferComplete = function(ev, state) {
        state.endUpload();
        updateStatus(state);
        state.setPosition(state.getPosition() + self.settings.chunkSize);
    };

    var updateStatus = function(state) {
        if (!self.onProgress) {
            return;
        }
        self.onProgress(state);
    };

    var transferFailed = function(ev, state) {
        state.endUpload();
        //console.log(ev);
    };

    var transferCanceled = function(ev, state) {
        state.endUpload();
        state.clear();
        removeUpload(state.getId());
    };

    var removeUpload = function(stateID) {
        for (i = 0; i < uploadStates.length; i++) {
            state = uploadStates[i];
            if (state.getId() == stateID) {
                uploadStates.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    var completeUpload = function(state) {
        state.clear();
        updateStatus(state);
        removeUpload(state.getId());
        if (self.settings.notifications) {
            item = document.querySelector("[data-upload-state='" + state.getId() + "']");
            item.className = item.className + ' complete';
            progress = item.getElementsByClassName('progress');
            item.removeChild(progress[0]);
            btn = item.getElementsByClassName('btn');
            item.removeChild(btn[0]);
        }


    }

    var cancelUpload = function(state) {

        state.endUpload();
        state.clear();
        removeUpload(state.getId());
        if (self.settings.notifications) {
            item = document.querySelector("[data-upload-state='" + state.getId() + "']");
            item.className = item.className + ' cancelled';
            progress = item.getElementsByClassName('progress');
            item.removeChild(progress[0]);
            btn = item.getElementsByClassName('btn');
            item.removeChild(btn[0]);
        }
    }

    var buildNotificationWindow = function(state) {
        if (!document.getElementById('uploadManager')) {
            //build the container for the notifications.
            var notificationWindow = document.createElement('div');
            notificationWindow.id = "uploadManager";
            var h = document.createElement('div');
            h.className = 'notification-header';
            h.id = "um-notificationHeader";
            h.innerHTML = 'Uploads';
            notificationWindow.appendChild(h);
            var b = document.createElement('div');
            b.className = 'notificiations-list';
            b.id = "um-notifications";
            notificationWindow.appendChild(b);
            document.getElementById(self.settings.appendTo).appendChild(notificationWindow);
        }

        var item = document.createElement('div');
        item.className = 'upload-item';
        item.setAttribute('data-upload-state', state.getId());
        var progress = document.createElement('div');
        progress.className = 'progress';
        var bar = document.createElement('div');
        bar.className = 'progress-bar progress-bar-striped';
        progress.appendChild(bar);
        item.appendChild(progress);
        var btn = document.createElement('a');
        btn.className = 'btn btn-small js-cancel-upload';
        btn.innerHTML = '&times;';
        item.appendChild(btn);
        var status = document.createElement('div');
        status.className = 'status';
        status.innerHTML = state.getFilename();
        item.appendChild(status);
        //prepend the new item to the list.
        document.getElementById('um-notifications').insertBefore(item, document.getElementById('um-notifications').firstChild);
        btn.addEventListener('click', function(ev) {
            cancelUpload(state);
        });

    }

    var confirmExit = function() {
        return 'If you leave the page your download will be cancelled. Are you sure you wish to continue?';
    }

    // Every 0.5 seconds, poll to see if there is stuff to upload
    interval = setInterval(uploadChunk, self.settings.pollInterval);

    return self;
};


function isArray(o) {
    return Object.prototype.toString.call(o) == "[object Array]";
}

// Assumes that target and source are either objects (Object or Array) or undefined
// Since will be used to convert to JSON, just reference objects where possible
function mergeObjects(target, source) {

    var item, tItem, o, idx;

    // If either argument is undefined, return the other.
    // If both are undefined, return undefined.
    if (typeof source == 'undefined') {
        return source;
    } else if (typeof target == 'undefined') {
        return target;
    }

    // Assume both are objects and don't care about inherited properties
    for (var prop in source) {
        item = source[prop];

        if (typeof item == 'object' && item !== null) {

            if (isArray(item) && item.length) {

                // deal with arrays, will be either array of primitives or array of objects
                // If primitives
                if (typeof item[0] != 'object') {

                    // if target doesn't have a similar property, just reference it
                    tItem = target[prop];
                    if (!tItem) {
                        target[prop] = item;

                        // Otherwise, copy only those members that don't exist on target
                    } else {

                        // Create an index of items on target
                        o = {};
                        for (var i = 0, iLen = tItem.length; i < iLen; i++) {
                            o[tItem[i]] = true
                        }

                        // Do check, push missing
                        for (var j = 0, jLen = item.length; j < jLen; j++) {

                            if (!(item[j] in o)) {
                                tItem.push(item[j]);
                            }
                        }
                    }
                } else {
                    // Deal with array of objects
                    // Create index of objects in target object using ID property
                    // Assume if target has same named property then it will be similar array
                    idx = {};
                    tItem = target[prop]

                    for (var k = 0, kLen = tItem.length; k < kLen; k++) {
                        idx[tItem[k].id] = tItem[k];
                    }

                    // Do updates
                    for (var l = 0, ll = item.length; l < ll; l++) {
                        // If target doesn't have an equivalent, just add it
                        if (!(item[l].id in idx)) {
                            tItem.push(item[l]);
                        } else {
                            mergeObjects(idx[item[l].id], item[l]);
                        }
                    }
                }
            } else {
                // deal with object
                mergeObjects(target[prop], item);
            }

        } else {
            // item is a primitive, just copy it over
            target[prop] = item;
        }
    }
    return target;
}

window.store = {
    localStoreSupport: function() {
        try {
            return 'localStorage' in window && window['localStorage'] !== null;
        } catch (e) {
            return false;
        }
    },
    set: function(name, value, days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            var expires = "; expires=" + date.toGMTString();
        } else {
            var expires = "";
        }
        if (this.localStoreSupport()) {
            localStorage.setItem(name, value);
        } else {
            document.cookie = name + "=" + value + expires + "; path=/";
        }
    },
    get: function(name) {
        if (this.localStoreSupport()) {
            return localStorage.getItem(name);
        } else {
            var nameEQ = name + "=";
            var ca = document.cookie.split(';');
            for (var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) == ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        }
    },
    del: function(name) {
        if (this.localStoreSupport()) {
            localStorage.removeItem(name);
        } else {
            this.set(name, "", -1);
        }
    }
}