"use strict";

var path = require('path');
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
var schema = mongoose.Schema;

var email = new schema({
    'x-message-id' : {
        type : String,
        required : true
    },
    sg_message_id : {
        type : String,
        required : false
    },
    from_email:  {
        type: String,
        required: true
    },
    to_email: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: false
    },
    isProcessed: {
        status : false,
        created_at : []
    },
    isDelivered: {
        status : false,
        created_at : []
    },
    isOpened: {
        status : false,
        created_at : []
    },
    isClickedLink: {
        status : false,
        created_at : []
    },
    created_at: {type: Date, default: Date.now }
});
email.index({ _id : 1, sg_message_id : -1  });
exports.email = mongoose.model('email', email);
