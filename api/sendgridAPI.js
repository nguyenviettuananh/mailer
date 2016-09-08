'use strict';
var path = require('path');
const API_KEY = require('../config').sendGrid.api_key;
var sg = require('sendgrid')(API_KEY);
module.exports = {
    request : function(to,from,subject,content,cc,bcc){
        return sg.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: {
                personalizations: [
                    {
                        to : to,
                        cc : cc,
                        bcc: bcc,
                        subject: subject,
                    },
                ],
                from: {
                    email: from,
                },
                content: [
                    {
                        type: 'text/html',
                        value: content,
                    },
                ],
                attachments : []
            },
        });
    }
}
