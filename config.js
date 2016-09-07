"use strict";

exports.db = {
    uri: 'mongodb://localhost/email',
    options: {
        config : {
            autoIndex : true
        }
    }
};

exports.sendGrid = {
    api_key : "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"
};