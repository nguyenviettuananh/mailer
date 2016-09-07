"use strict";

var mongoose = require('mongoose');
var winston = require('winston');
var path = require('path');

exports.init = function(connectUri, options, callback) {
    mongoose.connect(connectUri, options);

    mongoose.connection.on('connected', function(){
        winston.info('connected to db');
    });
    mongoose.connection.on('error', function(err){
        winston.info('connect error');
        callback(err);
    });
    mongoose.connection.on('disconnected', function(){
        winston.info('disconnected db');
    });
    mongoose.connection.once('open', function() {
        winston.info('db connection opened');
        callback(null, mongoose);
    });
};