'use strict';

const 
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),  
  request = require('request');
  
var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));


// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ? 
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

// grab the user model
var Order = require('./models/order');

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});
/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}


/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));
  //var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  if (message.attachments) {
          var attachment = message.attachments[0];

          if (attachment.type === 'location') {
          var location = message.attachments;
          }
          else
          { 
              var location;
          }
  }
 else
  {
      var location;
  }
  
  var quickReply = message.quick_reply;
  
  if (messageText) {

    switch (messageText) {
      case 'Hi':
        sendOrderMessage(senderID);
        break;
    }
  } else if (location) {

  // Update DB and Save location data.
  //Find model with recipientId and recent order_at date
  var query = { recipientId: recipientID };
  Order.findOneAndUpdate(query, { location: { title: location.title, coordinates: { lat: event.message.attachments[0].payload.coordinates.lat,
        long: event.message.attachments[0].payload.coordinates.long }}}, { sort: { 'order_at': -1 } }, function(err) {
  if (err) throw err;
  console.log('Location Data saved!');
});

  //Final Message
  sendTextMessage(senderID, "Thanks, your order is on the way");
  }
  //User selected an order
  if (quickReply) 
  {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);
    //Update order 
    //Find model with recipientId and recent order_at date
    var query = { recipientId: recipientID };
    Order.findOneAndUpdate(query, { order: { pizza: quickReplyPayload,}}, { sort: { 'order_at': -1 } }, function(err) {
     if (err) throw err;
     console.log('Order saved!');
    });

      switch (quickReplyPayload) {
      case 'Salami':
        sendLocationMessage(senderID);
      break;

      case 'Funghi':
        sendLocationMessage(senderID);
        break;  

      case 'Speciale':
        sendLocationMessage(senderID);
        break;   

      default:
        sendTextMessage(senderID, "Please order again!");
    }
   
    return;
  }}
/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

function sendOrderMessage(recipientId) {

  getProfileData(recipientId, function(body){
    //Save user data
    var newOrder = Order({
    order_at: new Date(),
    user_data: {
    recipientId: recipientId,
    first_name: body.first_name,
    last_name: body.last_name,
    gender: body.gender,
    locale: body.locale,
    timezone: body.timezone
   }
});
   //Create new order
  newOrder.save(function(err) {
  if (err) throw err;
  console.log(newOrder+'User Data saved!');
});

  var firstname = body.first_name;
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Hi "+firstname+", please choose which Pizza do you want to order:",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Salami",
          "payload":"Salami"
        },
        {
          "content_type":"text",
          "title":"Speciale",
          "payload":"Speciale"
        },
        {
          "content_type":"text",
          "title":"Funghi",
          "payload":"Funghi"
        }
      ]
    }
  };

  callSendAPI(messageData);
  });
}
function sendLocationMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Please send me your location!",
      quick_replies: [
        {
          "content_type":"location",
        },
      ]
    }
  };

  callSendAPI(messageData);
}


/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
}

function getProfileData (recipientId, callback)
{
request({
    url: 'https://graph.facebook.com/v2.6/'+recipientId,
    qs: {fields:'first_name,last_name,profile_pic,locale,timezone,gender',access_token: PAGE_ACCESS_TOKEN}, 
    method: 'GET', 
    json: true
}, function(error, response, body){
    if(error) {
        console.log(error);
    } else {
        console.log(response.statusCode, body);
        callback(body);
    }
});

}
// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;