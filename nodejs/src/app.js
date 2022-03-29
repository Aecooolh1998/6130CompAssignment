
//Object data modelling library for mongo
const mongoose = require('mongoose');

var nodeIsLeader = false;
var rabbitMQStarted = false; // Allows list nodeList to populate otherwise every node spits out its leader.

//Mongo db client library
//const MongoClient  = require('mongodb');

//Express web service library
const express = require('express')

//used to parse the server response from json to object.
const bodyParser = require('body-parser');

//Required for messege queueing for RabbitMQ
var amqp = require('amqplib/callback_api');

//Get the hostname of the node
const os = require('os');
var nodeHostName = os.hostname();

// Generate Random NodeID and the current time in seconds for establishing last message sent. 
var nodeID = Math.floor(Math.random() * (100 - 1 + 1) + 1);
var seconds = new Date().getTime() / 1000;

// Create list of nodes and message to be sent during timed interval.
var nodeMessage = { nodeID: nodeID, hostname: nodeHostName, lastMessage: seconds };
var nodeList = [];
nodeList.push(nodeMessage);

//instance of express and port to use for inbound connections.
const app = express()
const port = 3000

//connection string listing the mongo servers. This is an alternative to using a load balancer. THIS SHOULD BE DISCUSSED IN YOUR ASSIGNMENT.
const connectionString = 'mongodb://localmongo1:27017,localmongo2:27017,localmongo3:27017/notFlixDB?replicaSet=rs0';

// Here each node publishes if it is alive or not within five second intervals
setInterval(function () {
  amqp.connect('amqp://user:bitnami@6130CompAssignment_haproxy_1', function (error0, connection) {
    if (error0) {
      throw error0;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }
      var exchange = "node alive";
      seconds = new Date().getTime() / 1000;
      // No need to add alive here, as node wouldn't be sending messages if it wasn't alive.
      var msg = `{"nodeID": ${nodeID}, "hostname": "${nodeHostName}"}`
      // Having trouble sending it as JSON straight away, will resolve this later on.
      var jsonMsg = JSON.stringify(JSON.parse(msg));
      channel.assertExchange(exchange, 'fanout', {
        durable: false
      });
      channel.publish(exchange, '', Buffer.from(jsonMsg));
    });
    setTimeout(function () {
      connection.close();
    }, 500);
  });
}, 5000);

// Subscribe to alive messages, and add note to alive list based on if its ID exists in the list or not.
amqp.connect('amqp://user:bitnami@6130CompAssignment_haproxy_1', function (error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1;
    }
    var exchange = 'node alive';
    channel.assertExchange(exchange, 'fanout', {
      durable: false
    });
    channel.assertQueue('', {
      exclusive: true
    }, function (error2, q) {
      if (error2) {
        throw error2;
      }
      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q.queue);
      channel.bindQueue(q.queue, exchange, '');
      channel.consume(q.queue, function (msg) {
        if (msg.content) {
          rabbitMQStarted = true;
          console.log(" [x] %s", msg.content.toString());
          var incomingNode = JSON.parse(msg.content.toString());
          seconds = new Date().getTime() / 1000;
          //Check if node is in list by its ID, if not update the list, else amend node with current seconds value.
          nodeList.some(nodes => nodes.nodeID === incomingNode.nodeID) ? (nodeList.find(e => e.nodeID === incomingNode.nodeID)).lastMessage = seconds : nodeList.push(incomingNode);
          console.log(nodeList) // Debug code for now just checking list is populated properly.
        }
      }, {
        noAck: true
      });
    });
  });
});

// Every five seconds loop through nodesList and compares the ID against one another untill the maximum is found.
setInterval(function () {
  if (rabbitMQStarted) {
    var maxNodeID = 0; // To store current highest nodeID during the iteration.
    Object.entries(nodeList).forEach(([nodeID, prop]) => {
      if (prop.hostname != nodeHostName) {
        if (prop.nodeID > maxNodeID) {
          maxNodeID = prop.nodeID;
        }
      }
    });
    if (nodeID >= maxNodeID) {
      nodeIsLeader = true;
    }
  }
}, 5000);

//interval if leader then look through the nodes is anyone missing? if so run axois example to create.
//for a first add the capability to scale up ...

//tell express to use the body parser. Note - This function was built into express but then moved to a seperate package.
app.use(bodyParser.json());

//connect to the cluster
mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });


var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var Schema = mongoose.Schema;

var interactionSchema = new Schema({
  _id: Number,
  accountID: Number,
  userName: String,
  titleID: Number,
  userAction: String,
  dateTime: String,
  pointOfInteraction: String,
  typeOfInteraction: String
});

var interactionModel = mongoose.model('Interaction', interactionSchema, 'interaction');

app.get('/', (req, res) => {
  interactionModel.find({}, 'accountID userName titleID userAction dateTime pointOfInteraction typeOfInteraction', (err, interaction) => {
    if (err) return handleError(err);
    res.send(JSON.stringify(interaction))
  })
})

app.post('/', (req, res) => {
  var interaction_instance = new interactionModel(req.body);
  interaction_instance.save(function (err) {
    if (err) res.send('Error');
    res.send(JSON.stringify(req.body))
  });
})

app.put('/', (req, res) => {
  res.send('Got a PUT request at /')
})

app.delete('/', (req, res) => {
  res.send('Got a DELETE request at /')
})

//bind the express web service to the port specified
app.listen(port, () => {
  console.log(`Express Application listening at port ` + port)
})
