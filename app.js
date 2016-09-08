
global.LIBS_DIR = __dirname + '/libs';
global.MODELS_DIR = __dirname + '/models';
global.API_DIR = __dirname + '/api';
global.ROOT_DIR = __dirname;
var express = require('express');
var path = require('path');
var Promise = require('bluebird');
// var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
var nodemailer = require('nodemailer');
var Email = require(path.join(MODELS_DIR,'email')).email;
// var flash = require('express-flash');
// var passport = require('passport');
// var mongoose = require('mongoose');
var _ = require('lodash');
var app = express();
app.set('trust proxy', 1); // trust first proxy
var db = require(path.join(LIBS_DIR, 'db'));
var configs = require('./config');
var winston = require('winston');
const API_KEY = configs.sendGrid.api_key;
var sg = require('sendgrid')(API_KEY);
var sgRequest = require(path.join(API_DIR,'sendgridAPI')).request;

var multer  = require('multer')
    , upload = multer({ storage: multer.memoryStorage({})})
    , helper = require('sendgrid').mail;

function timeConverter(UNIX_timestamp){
    var a = new Date(UNIX_timestamp * 1000);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
}

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
// app.use(methodOverride());
// app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('views', __dirname + "/views");
app.set('view engine', 'twig');


db.init(configs.db.uri, configs.db.options, function(err){
    if(err) {
        winston.error('Database initializing failed: ' + err);
        return;
    }

    winston.info('Initializing database completed');
    app.get('/',function(req,res){
        res.render('index')
    });

    app.get('/email-tpl',function (req, res) {
        res.render('email_tpl/email')
    }),

    app.post('/notify',function(req,res){
        //Need to create redis queue
        var events = req.body;
        Promise.map(events,function(event){
            var pattern = event.sg_message_id.split('.').shift();
            if(event.event == "processed"){
                return Email.findOneAndUpdate({
                    'x-message-id' : pattern,
                    to_email : event.email
                },{
                    $set : {
                        sg_message_id : event.sg_message_id,
                        isProcessed : {
                            status : true,
                            created_at : timeConverter(event.timestamp)
                        }
                    }
                })
            } else if(event.event == 'delivered'){
                return Email.findOneAndUpdate({
                    sg_message_id : event.sg_message_id
                },{
                    $set : {
                        isDelivered : {
                            status : true,
                            created_at : timeConverter(event.timestamp)
                        }
                    }
                })
            } else if(event.event == 'open'){
                console.log('open',event);
                return Email.findOneAndUpdate({
                    sg_message_id : event.sg_message_id
                },{
                    $set : {
                        isOpened : {
                            status : true
                        }
                    }
                },{
                    new : true
                }).exec().then(function(event){
                    console.log(event);
                    return Email.findOneAndUpdate({
                        sg_message_id : event.sg_message_id
                    },{
                        $push : {
                            'isOpened.created_at' : timeConverter(event.timestamp)
                        }
                    })
                })
            } else if(event.event == 'click'){
                console.log('click',event);
                return Email.findOneAndUpdate({
                    sg_message_id : event.sg_message_id
                },{
                    $set : {
                        isClickedLink : {
                            status : true
                        }
                    }
                },{
                    new : true
                }).exec().then(function(event){
                    return Email.findOneAndUpdate({
                        sg_message_id : event.sg_message_id
                    },{
                        $push : {
                            'isClickedLink.created_at' : timeConverter(event.timestamp)
                        }
                    })
                })
            }
        }).then(function(){
            res.sendStatus(200)
        }).catch(function (err) {
            console.log(err);
            res.sendStatus(500)
        })
    });


    app.post('/send-att',upload.array('attachments',4),function(req,res){
        var to_email = req.body.to.split(','),to = [];
        var cc1 =  (req.body.cc.length > 0) ? req.body.cc.split(',') : null, cc = [];
        var bcc1 = (req.body.bcc.length > 0) ? req.body.bcc.split(',') : null, bcc = [];
        to_email.map(function(val){
            to.push({
                email : val
            })
        });
        if(cc1 == null){
            cc = null
        } else {
            cc1.map(function(val){
                cc.push({
                    email : val
                })
            });
        }
        if(bcc1 == null){
            bcc = null
        } else {
            bcc1.map(function(val){
                bcc.push({
                    email : val
                })
            });
        };
        var fileInfo = req.files;

        var request = sgRequest(to,req.body.from_email,req.body.subject,req.body.content,cc,bcc);
        if(fileInfo){
            fileInfo.map(function(file){
                request.body.attachments.push({
                    filename : file.originalname,
                    content : file.buffer.toString('base64'),
                    type : file.mimeType
                });
            })
        }
        console.log(request.body.personalizations);
        sg.API(request,function(error,response){
            console.log(response);
            if(error){
                res.json({
                    err : 1,
                    msg : "Error : " + error
                })
            } else {
                res.json({
                    err : 0,
                    msg : "Success"
                })
            }
        })
        // res.redirect('/')
    })

    app.post('/send-mail',function(req,res){
        var request = sgRequest(req.body.to_email,req.body.from_email,req.body.subject,req.body.content,req.body.cc,req.body.bcc);
        var receivers = req.body.to_email.concat(req.body.cc,req.body.bcc);
        sg.API(request,function(error,response){
            if(error){
                res.json({
                    err : 1,
                    msg : "Error + " + error
                })
            } else {
                Promise.map(receivers,function(receiver){
                    var data = {
                        'x-message-id' : response.headers['x-message-id'],
                        from_email : req.body.from_email,
                        to_email :  receiver.email,
                        subject : req.body.subject,
                        isProcessed : {
                            status : false
                        },
                        isDelivered : {
                            status : false
                        },
                        isOpened : {
                            status : false
                        },
                        isClicked : {
                            status : false
                        }
                    };
                    var email = new Email(data);
                    return email.save()
                }).then(function(){
                    res.json({
                        err : 0,
                        msg : "Success : "
                    })
                }).catch(function(err){
                    console.log(err);
                    res.json({
                        err : 1,
                        msg : "Error : " + err
                    })
                })
            }
        })
    });

    app.listen(3000,function(){
        console.log('App is running at port 3000');
    })
})
